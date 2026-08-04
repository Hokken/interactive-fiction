import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import logger from './loggerService.js';

class VectorService {
  constructor() {
    this.client = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
    this.openai = null;
    this.collectionName = 'game_context';
    this.vectorSize = 1536; // OpenAI text-embedding-3-small dimension
    this.initialized = false;
  }

  getOpenAIClient() {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.openai;
  }

  async ensureCollection() {
    if (this.initialized) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
        console.log(`Created Qdrant collection: ${this.collectionName}`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to ensure Qdrant collection:', error);
      // Don't crash, just log. RAG will fail gracefully.
    }
  }

  async getEmbedding(text) {
    if (this.openai) {
      logger.logDebug('[VECTOR] Generating embedding for text (length:', text.length, ')');
    }
    const client = this.getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    if (this.openai) {
      logger.logDebug('[VECTOR] Embedding generated.');
    }
    return response.data[0].embedding;
  }

  /**
   * Add a memory or lore snippet to the vector DB
   * @param {string} text - The content to store
   * @param {Object} metadata - Additional info (type, sceneId, turn, etc.)
   * @param {string} requestId - Request ID for logging
   * @param {boolean} checkSimilarity - Whether to check for duplicates before adding
   */
  async addMemory(text, metadata = {}, requestId = null, checkSimilarity = false) {
    await this.ensureCollection();
    
    if (requestId) {
      logger.logMemoryAddition(requestId, text, metadata);
    }

    try {
      const vector = await this.getEmbedding(text);

      if (checkSimilarity) {
        const searchResult = await this.client.search(this.collectionName, {
          vector,
          limit: 1,
          with_payload: false, 
        });

        if (searchResult.length > 0 && searchResult[0].score > 0.92) {
          if (requestId) {
            logger.logDebug(`[VECTOR] Duplicate detected (Score: ${searchResult[0].score}). Skipping upsert.`);
            // Log this event explicitly for visibility
            logger.writeLog(`[MEMORY_SKIPPED] Duplicate detected for "${text.substring(0, 50)}..." (Score: ${searchResult[0].score})`);
            console.log(`[MEMORY_SKIPPED] Duplicate detected (Score: ${searchResult[0].score})`);
          }
          return; 
        }
      }
      
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: uuidv4(),
            vector,
            payload: {
              content: text,
              ...metadata,
              timestamp: Date.now()
            },
          },
        ],
      });
      if (requestId) {
        logger.logMemoryAdded(requestId, text, metadata);
      }
    } catch (error) {
      console.error('Failed to add memory to vector DB:', error);
      if (requestId) {
        logger.logError(requestId, error, 'VectorService.addMemory');
      }
    }
  }

  /**
   * Search for relevant context
   * @param {string} query - User action or query
   * @param {number} limit - Number of results
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<string[]>} Array of context strings
   */
  async searchContext(query, limit = 3, requestId = null) {
    await this.ensureCollection();

    if (requestId) {
      logger.logVectorSearch(requestId, query);
    }

    try {
      const vector = await this.getEmbedding(query);
      
      const searchResult = await this.client.search(this.collectionName, {
        vector,
        limit,
        with_payload: true,
      });

      const results = searchResult.map(res => res.payload.content);
      
      if (requestId) {
        logger.logVectorSearchResult(requestId, results);
      }

      return results;
    } catch (error) {
      console.error('Vector search failed:', error);
      if (requestId) {
        logger.logError(requestId, error, 'VectorService.searchContext');
      }
      return [];
    }
  }
}

export default new VectorService();


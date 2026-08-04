# Interactive Fiction Backend

This is the backend API for the Interactive Fiction game, providing AI validation and processing services.

## Features

- **Request Validation**: Uses Anthropic Haiku to validate user requests before processing
- **AI Processing**: Integrates with OpenAI GPT-4o-mini for game responses
- **JSON Validation**: Ensures all AI responses are valid JSON
- **Streaming Support**: Real-time streaming responses for better UX
- **Security**: Helmet middleware and CORS protection

## Architecture

### Validation Flow
1. Player sends action to frontend
2. Frontend sends action + game state to backend `/api/game/action`
3. Backend validates request with Anthropic Haiku
4. If invalid, returns fantasy-appropriate rejection
5. If valid, processes with OpenAI
6. Backend validates JSON response format
7. Returns processed response to frontend

### API Endpoints

#### POST `/api/game/action`
Process a player action with validation.

**Request Body:**
```json
{
  "playerAction": "go north",
  "gameState": {
    "currentScene": { "id": "dungeon_cell", "description": "..." },
    "inventory": ["torch"],
    "history": [...],
    "memories": [...],
    "turnSummaries": [...],
    "compactedSummaries": [...]
  }
}
```

**Response:**
```json
{
  "narrative": "You walk north into a dark corridor...",
  "player_feedback": null,
  "events": [
    { "type": "CHANGE_SCENE", "scene_id": "dungeon_corridor" }
  ],
  "validation_passed": true,
  "validation_reason": "Valid movement command"
}
```

#### POST `/api/game/action/stream`
Same as above but with Server-Sent Events streaming.

#### POST `/api/game/summary`
Generate turn summary.

**Request Body:**
```json
{
  "playerMessage": "I pick up the torch",
  "aiResponse": "You pick up the flickering torch..."
}
```

#### POST `/api/game/compact`
Compact multiple summaries.

**Request Body:**
```json
{
  "summaries": ["Player picked up torch", "Player opened door", ...]
}
```

#### GET `/health`
Health check endpoint.

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and add your API keys:
   ```
   ANTHROPIC_API_KEY=your_anthropic_key_here
   OPENAI_API_KEY=your_openai_key_here
   ```

3. **Start Server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for request validation
- `OPENAI_API_KEY` - Required for AI responses
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:5173)

## Validation Rules

The Anthropic Haiku validator checks for:

- ✅ **Accept**: Fantasy-appropriate actions (movement, examination, item use)
- ✅ **Accept**: Fantasy dialogue and questions
- ❌ **Reject**: Modern technology terms (phone, internet, computer, etc.)
- ❌ **Reject**: Breaking character or game manipulation attempts
- ❌ **Reject**: Inappropriate content

## Error Handling

- Invalid requests return 400 with error details
- Validation failures return fantasy-appropriate responses
- AI service errors return 500 with error details
- All errors include request IDs for debugging

## Security

- Helmet middleware for security headers
- CORS protection for cross-origin requests
- Input validation and sanitization
- No sensitive data in error responses (production)

## Logging

All requests are logged with:
- Player actions and scene context
- Validation results and reasons
- AI response processing
- Performance metrics

## Development

```bash
# Start with hot reload
npm run dev

# Run tests
npm test

# Check health
curl http://localhost:3001/health
```
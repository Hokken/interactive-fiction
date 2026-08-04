import { useState } from 'react';
import styles from './GameInventory.module.scss';

export default function GameInventory({ inventory, onUseItem }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleItemClick = (item) => {
    if (onUseItem) {
      onUseItem(`use ${item}`);
    }
    setIsOpen(false); // Close dropdown after using item
  };

  return (
    <div className={styles.inventoryDropdown}>
      <button 
        className={styles.inventoryButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        Inventory ({inventory.length})
      </button>
      
      {isOpen && (
        <div className={styles.dropdownContent}>
          {inventory.length > 0 ? (
            <div className={styles.itemsList}>
              {inventory.map((item, index) => (
                <button
                  key={index}
                  className={styles.item}
                  onClick={() => handleItemClick(item)}
                  type="button"
                  aria-label={`Use ${item}`}
                >
                  <img 
                    src={`/src/assets/items/${item.replace('_', '-')}.png`} 
                    alt={item}
                    className={styles.itemIcon}
                  />
                  <span className={styles.itemName}>{item.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMessage}>Your inventory is empty</p>
          )}
        </div>
      )}
    </div>
  );
}
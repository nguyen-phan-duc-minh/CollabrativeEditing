import React, { useState } from 'react';
import { FaKeyboard, FaTimes } from 'react-icons/fa';
import './KeyboardShortcuts.css';

export default function KeyboardShortcuts() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';
  
  const shortcuts = [
    { category: 'File', items: [
      { keys: [`${modKey}`, 'S'], description: 'Save document' },
      { keys: [`${modKey}`, 'P'], description: 'Export document' },
      { keys: [`${modKey}⇧`, 'S'], description: 'Share document' },
    ]},
    { category: 'Text Formatting', items: [
      { keys: [`${modKey}`, 'B'], description: 'Bold' },
      { keys: [`${modKey}`, 'I'], description: 'Italic' },
      { keys: [`${modKey}`, 'U'], description: 'Underline' },
    ]},
    { category: 'Editing', items: [
      { keys: [`${modKey}`, 'Z'], description: 'Undo' },
      { keys: [`${modKey}⇧`, 'Z'], description: 'Redo' },
      { keys: [`${modKey}`, 'Y'], description: 'Redo (alternative)' },
    ]},
    { category: 'Navigation', items: [
      { keys: ['Alt', 'C'], description: 'Toggle comments' },
      { keys: ['Alt', 'H'], description: 'Version history' },
    ]}
  ];

  return (
    <>
      <button 
        className="keyboard-shortcuts-trigger"
        onClick={() => setShowShortcuts(true)}
        title="Keyboard shortcuts"
      >
        <FaKeyboard />
      </button>

      {showShortcuts && (
        <div className="shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h3>Keyboard Shortcuts</h3>
              <button 
                className="close-shortcuts"
                onClick={() => setShowShortcuts(false)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="shortcuts-content">
              {shortcuts.map((category) => (
                <div key={category.category} className="shortcuts-category">
                  <h4>{category.category}</h4>
                  <div className="shortcuts-list">
                    {category.items.map((shortcut, index) => (
                      <div key={index} className="shortcut-item">
                        <div className="shortcut-keys">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="key">
                              {key}
                            </span>
                          ))}
                        </div>
                        <span className="shortcut-description">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="shortcuts-footer">
              <p>Tip: You can press <span className="key">?</span> to open this dialog</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
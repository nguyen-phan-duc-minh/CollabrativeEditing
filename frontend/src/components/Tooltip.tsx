import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

interface TooltipProps {
  children: ReactNode;
  content: string;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  content, 
  shortcut, 
  position = 'bottom' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  const formatShortcut = (shortcut: string) => {
    return shortcut.replace('Ctrl', isMac ? '⌘' : 'Ctrl');
  };

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 999999,
        pointerEvents: 'none'
      };

      switch (position) {
        case 'top':
          style.bottom = window.innerHeight - rect.top + 8;
          style.left = rect.left + rect.width / 2;
          style.transform = 'translateX(-50%)';
          break;
        case 'bottom':
          style.top = rect.bottom + 8;
          style.left = rect.left + rect.width / 2;
          style.transform = 'translateX(-50%)';
          break;
        case 'left':
          style.top = rect.top + rect.height / 2;
          style.right = window.innerWidth - rect.left + 8;
          style.transform = 'translateY(-50%)';
          break;
        case 'right':
          style.top = rect.top + rect.height / 2;
          style.left = rect.right + 8;
          style.transform = 'translateY(-50%)';
          break;
      }

      setTooltipStyle(style);
    }
  }, [isVisible, position]);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const tooltipContent = (
    <div style={tooltipStyle}>
      <div className="tooltip-content">
        {content}
        {shortcut && (
          <div className="tooltip-shortcut">
            {formatShortcut(shortcut)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div 
        ref={triggerRef}
        className="tooltip-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isVisible && createPortal(tooltipContent, document.body)}
    </>
  );
};

export default Tooltip;
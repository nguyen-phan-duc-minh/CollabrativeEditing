"""
Operational Transformation (OT) Engine
Simplified implementation for collaborative editing
"""

import json

class OTEngine:
    """
    Operational Transformation engine for conflict resolution
    Supports basic text operations: insert, delete, retain
    """
    
    @staticmethod
    def transform(op1, op2, side='left'):
        """
        Transform two operations against each other
        Returns transformed version of op1 against op2
        
        Args:
            op1: First operation
            op2: Second operation  
            side: 'left' or 'right' - determines priority for ties
        """
        if op1['type'] == 'retain' and op2['type'] == 'retain':
            # Both retain
            return op1
        
        elif op1['type'] == 'insert' and op2['type'] == 'retain':
            # op1 inserts, op2 retains - no change needed
            return op1
        
        elif op1['type'] == 'insert' and op2['type'] == 'insert':
            # Both insert at same position
            if side == 'left':
                return op1
            else:
                # Adjust position
                return {
                    'type': 'insert',
                    'position': op1['position'] + len(op2.get('text', '')),
                    'text': op1['text']
                }
        
        elif op1['type'] == 'insert' and op2['type'] == 'delete':
            # op1 inserts, op2 deletes
            if op1['position'] <= op2['position']:
                return op1
            elif op1['position'] > op2['position'] + op2.get('length', 0):
                return {
                    'type': 'insert',
                    'position': op1['position'] - op2.get('length', 0),
                    'text': op1['text']
                }
            else:
                # Insert position is within deleted range
                return {
                    'type': 'insert',
                    'position': op2['position'],
                    'text': op1['text']
                }
        
        elif op1['type'] == 'delete' and op2['type'] == 'retain':
            # op1 deletes, op2 retains
            return op1
        
        elif op1['type'] == 'delete' and op2['type'] == 'insert':
            # op1 deletes, op2 inserts
            if op1['position'] >= op2['position']:
                return {
                    'type': 'delete',
                    'position': op1['position'] + len(op2.get('text', '')),
                    'length': op1.get('length', 0)
                }
            else:
                return op1
        
        elif op1['type'] == 'delete' and op2['type'] == 'delete':
            # Both delete
            if op1['position'] >= op2['position'] + op2.get('length', 0):
                # op1 is after op2
                return {
                    'type': 'delete',
                    'position': op1['position'] - op2.get('length', 0),
                    'length': op1.get('length', 0)
                }
            elif op1['position'] + op1.get('length', 0) <= op2['position']:
                # op1 is before op2
                return op1
            else:
                # Overlapping deletes - complex case
                start = min(op1['position'], op2['position'])
                end1 = op1['position'] + op1.get('length', 0)
                end2 = op2['position'] + op2.get('length', 0)
                
                if op1['position'] < op2['position']:
                    new_length = max(0, op1.get('length', 0) - (end2 - op1['position']))
                    return {
                        'type': 'delete',
                        'position': op1['position'],
                        'length': new_length
                    } if new_length > 0 else None
                else:
                    return None  # This deletion was already done by op2
        
        return op1
    
    @staticmethod
    def compose(ops):
        """
        Compose multiple operations into one
        Returns a single operation that has the same effect as applying all ops
        """
        if not ops:
            return None
        
        if len(ops) == 1:
            return ops[0]
        
        # For simplicity, return the list of operations
        # In a production system, you'd merge operations intelligently
        return ops
    
    @staticmethod
    def apply_operation(content, operation):
        """
        Apply an operation to content
        
        Args:
            content: Current document content (string or JSON)
            operation: Operation to apply
        
        Returns:
            Updated content
        """
        op_type = operation.get('type')
        
        if isinstance(content, str):
            # Simple text operations
            if op_type == 'insert':
                position = operation.get('position', 0)
                text = operation.get('text', '')
                return content[:position] + text + content[position:]
            
            elif op_type == 'delete':
                position = operation.get('position', 0)
                length = operation.get('length', 0)
                return content[:position] + content[position + length:]
            
            elif op_type == 'retain':
                return content
        
        else:
            # JSON content (TipTap/ProseMirror format)
            # For complex editors, you'd apply transformations to the JSON structure
            # This is a simplified version
            return content
        
        return content
    
    @staticmethod
    def validate_operation(operation):
        """Validate operation structure"""
        if not isinstance(operation, dict):
            return False
        
        op_type = operation.get('type')
        if op_type not in ['insert', 'delete', 'retain']:
            return False
        
        if op_type == 'insert':
            return 'position' in operation and 'text' in operation
        
        elif op_type == 'delete':
            return 'position' in operation and 'length' in operation
        
        elif op_type == 'retain':
            return True
        
        return False
    
    @staticmethod
    def invert_operation(operation):
        """
        Invert an operation (for undo)
        
        Args:
            operation: Operation to invert
        
        Returns:
            Inverted operation
        """
        op_type = operation.get('type')
        
        if op_type == 'insert':
            # Invert insert -> delete
            return {
                'type': 'delete',
                'position': operation['position'],
                'length': len(operation.get('text', ''))
            }
        
        elif op_type == 'delete':
            # Invert delete -> insert (requires original text)
            # This is simplified - in practice you need to store deleted text
            return {
                'type': 'insert',
                'position': operation['position'],
                'text': operation.get('deleted_text', '')
            }
        
        return operation

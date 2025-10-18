import React, { useState, useRef, useEffect } from 'react';
import { FaRobot, FaPaperPlane, FaSpinner, FaCopy, FaCheck, FaTimes, FaMagic, FaLanguage, FaFileAlt, FaLightbulb } from 'react-icons/fa';
import './ChatBot.css';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatBotProps {
  show: boolean;
  onHide: () => void;
  documentContent?: string;
  onInsertText?: (text: string) => void;
  onReplaceText?: (text: string) => void;
}

const ChatBot: React.FC<ChatBotProps> = ({
  show,
  onHide,
  documentContent = '',
  onInsertText,
  onReplaceText
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Xin chào! Tôi là AI Writing Assistant. Tôi có thể giúp bạn:\n\n• Viết và chỉnh sửa nội dung\n• Kiểm tra ngữ pháp và chính tả\n• Dịch thuật văn bản\n• Tóm tắt và phân tích\n• Gợi ý ý tưởng viết\n\nBạn cần hỗ trợ gì?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
    }
  }, [show]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await callAIService(inputMessage.trim(), documentContent);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling AI service:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const callAIService = async (message: string, context: string): Promise<string> => {
    // Sử dụng API Gemini miễn phí
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: context.substring(0, 4000), // Giới hạn context để tránh quá tải
        }),
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const data = await response.json();
      return data.response || 'Xin lỗi, tôi không thể tạo phản hồi lúc này.';
    } catch (error) {
      // Fallback response khi API không khả dụng
      return generateFallbackResponse(message);
    }
  };

  const generateFallbackResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('dịch') || lowerMessage.includes('translate')) {
      return 'Để dịch văn bản, vui lòng cung cấp nội dung cần dịch và ngôn ngữ đích. Ví dụ: "Dịch sang tiếng Anh: Xin chào"';
    }
    
    if (lowerMessage.includes('ngữ pháp') || lowerMessage.includes('grammar')) {
      return 'Để kiểm tra ngữ pháp, vui lòng gửi đoạn văn bản cần kiểm tra. Tôi sẽ giúp bạn sửa lỗi và cải thiện câu từ.';
    }
    
    if (lowerMessage.includes('tóm tắt') || lowerMessage.includes('summary')) {
      return 'Để tóm tắt nội dung, vui lòng cung cấp văn bản cần tóm tắt. Tôi sẽ tạo bản tóm tắt ngắn gọn và đầy đủ ý chính.';
    }
    
    if (lowerMessage.includes('ý tưởng') || lowerMessage.includes('idea')) {
      return 'Tôi có thể giúp bạn:\n• Tạo outline cho bài viết\n• Gợi ý chủ đề\n• Phát triển ý tưởng\n• Tạo tiêu đề hấp dẫn\n\nVui lòng cho tôi biết chủ đề bạn muốn viết về.';
    }
    
    return 'Tôi có thể giúp bạn với các tác vụ viết như:\n• Chỉnh sửa và cải thiện văn bản\n• Kiểm tra ngữ pháp\n• Dịch thuật\n• Tóm tắt nội dung\n• Gợi ý ý tưởng\n\nVui lòng mô tả cụ thể hơn về những gì bạn cần hỗ trợ.';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const insertTextToDocument = (text: string) => {
    if (onInsertText) {
      onInsertText(text);
    }
  };

  const replaceSelectedText = (text: string) => {
    if (onReplaceText) {
      onReplaceText(text);
    }
  };

  const quickActions = [
    {
      icon: <FaFileAlt />,
      label: 'Cải thiện văn bản',
      prompt: 'Hãy cải thiện đoạn văn bản này để rõ ràng và mạch lạc hơn:'
    },
    {
      icon: <FaLanguage />,
      label: 'Dịch sang tiếng Anh',
      prompt: 'Dịch đoạn văn bản này sang tiếng Anh:'
    },
    {
      icon: <FaLightbulb />,
      label: 'Gợi ý ý tưởng',
      prompt: 'Tôi đang viết về chủ đề này, hãy gợi ý thêm ý tưởng:'
    },
    {
      icon: <FaMagic />,
      label: 'Kiểm tra ngữ pháp',
      prompt: 'Kiểm tra và sửa lỗi ngữ pháp trong đoạn văn bản này:'
    }
  ];

  const handleQuickAction = (prompt: string) => {
    const selectedText = window.getSelection()?.toString() || '';
    const fullMessage = selectedText 
      ? `${prompt}\n\n"${selectedText}"`
      : prompt;
    setInputMessage(fullMessage);
  };

  if (!show) return null;

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-title">
            <FaRobot />
            <span>AI Writing Assistant</span>
          </div>
          <button className="chatbot-close" onClick={onHide}>
            <FaTimes />
          </button>
        </div>

        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action.prompt)}
              title={action.label}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        <div className="chatbot-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.type}`}
            >
              <div className="message-content">
                {message.content.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < message.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
              
              {message.type === 'assistant' && (
                <div className="message-actions">
                  <button
                    className="message-action-btn"
                    onClick={() => copyToClipboard(message.content, message.id)}
                    title="Copy to clipboard"
                  >
                    {copiedMessageId === message.id ? <FaCheck /> : <FaCopy />}
                  </button>
                  {/* <button
                    className="message-action-btn"
                    onClick={() => insertTextToDocument(message.content)}
                    title="Insert into document"
                  >
                    ↩️
                  </button> */}
                </div>
              )}
              
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant loading">
              <div className="message-content">
                <FaSpinner className="spinning" />
                <span>Đang suy nghĩ...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập câu hỏi hoặc yêu cầu của bạn..."
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="send-button"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
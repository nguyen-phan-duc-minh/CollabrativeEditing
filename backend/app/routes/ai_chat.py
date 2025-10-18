from flask import Blueprint, request, jsonify
import os
import requests
import json
from app.auth import require_auth

bp = Blueprint('ai', __name__, url_prefix='/api/ai')

# Configuration for different AI providers
AI_PROVIDERS = {
    'gemini': {
        'api_key': os.getenv('GEMINI_API_KEY'),
        'endpoint': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
    },
    'openai_compatible': {
        'api_key': os.getenv('OPENAI_API_KEY') or 'dummy',
        'endpoint': os.getenv('OPENAI_ENDPOINT') or 'https://api.openai.com/v1/chat/completions',
        'model': os.getenv('OPENAI_MODEL') or 'gpt-3.5-turbo'
    }
}

def call_gemini_api(message: str, context: str = "") -> str:
    """Call Google Gemini API"""
    api_key = AI_PROVIDERS['gemini']['api_key']
    if not api_key:
        raise Exception("Gemini API key not configured")
    
    # Prepare system prompt for writing assistance
    system_prompt = """Bạn là một AI Writing Assistant chuyên nghiệp, giúp người dùng viết và chỉnh sửa tài liệu.

Khả năng của bạn:
- Viết và chỉnh sửa nội dung
- Kiểm tra ngữ pháp và chính tả (tiếng Việt và tiếng Anh)
- Dịch thuật giữa các ngôn ngữ
- Tóm tắt và phân tích văn bản
- Gợi ý ý tưởng và cấu trúc bài viết
- Cải thiện phong cách viết

Hãy trả lời một cách hữu ích, chính xác và thân thiện. Sử dụng tiếng Việt trừ khi được yêu cầu khác."""

    if context:
        system_prompt += f"\n\nNội dung tài liệu hiện tại:\n{context}"

    payload = {
        "contents": [{
            "parts": [{
                "text": f"{system_prompt}\n\nCâu hỏi của người dùng: {message}"
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 1024,
        }
    }
    
    try:
        response = requests.post(
            f"{AI_PROVIDERS['gemini']['endpoint']}?key={api_key}",
            headers={'Content-Type': 'application/json'},
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'candidates' in data and len(data['candidates']) > 0:
                content = data['candidates'][0]['content']['parts'][0]['text']
                return content.strip()
        
        raise Exception(f"Gemini API error: {response.status_code}")
    except Exception as e:
        print(f"Gemini API call failed: {e}")
        raise

def call_openai_compatible_api(message: str, context: str = "") -> str:
    """Call OpenAI-compatible API"""
    config = AI_PROVIDERS['openai_compatible']
    
    system_message = """Bạn là một AI Writing Assistant chuyên nghiệp, giúp người dùng viết và chỉnh sửa tài liệu.

Khả năng của bạn:
- Viết và chỉnh sửa nội dung
- Kiểm tra ngữ pháp và chính tả (tiếng Việt và tiếng Anh)  
- Dịch thuật giữa các ngôn ngữ
- Tóm tắt và phân tích văn bản
- Gợi ý ý tưởng và cấu trúc bài viết
- Cải thiện phong cách viết

Hãy trả lời một cách hữ ích, chính xác và thân thiện. Sử dụng tiếng Việt trừ khi được yêu cầu khác."""

    if context:
        system_message += f"\n\nNội dung tài liệu hiện tại:\n{context}"

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": message}
    ]
    
    payload = {
        "model": config['model'],
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {config["api_key"]}'
    }
    
    try:
        response = requests.post(
            config['endpoint'],
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'choices' in data and len(data['choices']) > 0:
                content = data['choices'][0]['message']['content']
                return content.strip()
        
        raise Exception(f"API error: {response.status_code}")
    except Exception as e:
        print(f"OpenAI-compatible API call failed: {e}")
        raise

def generate_fallback_response(message: str, context: str = "") -> str:
    """Generate fallback response when AI services are unavailable"""
    message_lower = message.lower()
    
    # Grammar check
    if any(keyword in message_lower for keyword in ['ngữ pháp', 'grammar', 'chính tả', 'spelling']):
        return """Để kiểm tra ngữ pháp và chính tả:

1. **Tiếng Việt**: Kiểm tra dấu câu, chính tả từ ngữ, cấu trúc câu
2. **Tiếng Anh**: Kiểm tra Subject-Verb agreement, Tenses, Articles

**Gợi ý chung**:
• Đọc lại văn bản sau khi viết
• Sử dụng công cụ kiểm tra chính tả
• Chia nhỏ câu dài thành câu ngắn
• Kiểm tra dấu phẩy và dấu câu

Vui lòng cung cấp đoạn văn bản cần kiểm tra để tôi có thể hỗ trợ cụ thể hơn."""

    # Translation
    elif any(keyword in message_lower for keyword in ['dịch', 'translate']):
        return """Để dịch văn bản hiệu quả:

**Các ngôn ngữ phổ biến**:
• Việt ↔ Anh
• Việt ↔ Trung 
• Việt ↔ Nhật
• Việt ↔ Hàn

**Lời khuyên**:
• Dịch ý nghĩa, không dịch từng từ
• Chú ý văn hóa và ngữ cảnh
• Kiểm tra lại bản dịch

Ví dụ: "Dịch sang tiếng Anh: Xin chào, tôi là AI Assistant"
Kết quả: "Hello, I am an AI Assistant" """

    # Summarization
    elif any(keyword in message_lower for keyword in ['tóm tắt', 'summary']):
        return """Để tóm tắt văn bản hiệu quả:

**Các bước**:
1. Đọc và hiểu toàn bộ nội dung
2. Xác định ý chính và ý phụ
3. Loại bỏ thông tin không cần thiết
4. Viết lại bằng từ ngữ của bạn

**Độ dài tóm tắt**:
• Ngắn: 1-2 câu (key points)
• Vừa: 1 đoạn (main ideas)
• Dài: Nhiều đoạn (detailed summary)

Vui lòng cung cấp văn bản cần tóm tắt."""

    # Content improvement
    elif any(keyword in message_lower for keyword in ['cải thiện', 'improve', 'chỉnh sửa', 'edit']):
        return """Để cải thiện văn bản:

**Cấu trúc**:
• Mở bài: Giới thiệu chủ đề
• Thân bài: Phát triển ý tưởng 
• Kết bài: Tổng kết, đưa ra kết luận

**Phong cách**:
• Sử dụng từ ngữ phù hợp với đối tượng đọc
• Tránh lặp từ, câu dài khó hiểu
• Thêm ví dụ minh họa cụ thể

**Kỹ thuật**:
• Sử dụng từ nối logic
• Chia đoạn hợp lý
• Kiểm tra tính nhất quán

Vui lòng chia sẻ đoạn văn bản cần cải thiện."""

    # Ideas and brainstorming
    elif any(keyword in message_lower for keyword in ['ý tưởng', 'idea', 'brainstorm', 'outline']):
        return """Tôi có thể giúp bạn phát triển ý tưởng:

**Các loại bài viết**:
• Báo cáo, thuyết trình
• Blog, bài viết cá nhân
• Đề xuất, kế hoạch
• Email, thư từ chuyên nghiệp

**Kỹ thuật tạo ý tưởng**:
• Mindmap (sơ đồ tư duy)
• 5W1H (What, When, Where, Who, Why, How)
• So sánh và đối chiếu
• Nguyên nhân - Kết quả

**Cấu trúc outline**:
1. Chủ đề chính
2. Các ý lớn (3-5 ý)
3. Ý nhỏ và ví dụ
4. Kết luận

Vui lòng cho tôi biết chủ đề bạn muốn viết về."""

    else:
        return """Xin chào! Tôi là AI Writing Assistant, có thể hỗ trợ bạn:

🔸 **Viết và chỉnh sửa**: Cải thiện văn phong, cấu trúc bài viết
🔸 **Kiểm tra ngữ pháp**: Sửa lỗi chính tả, ngữ pháp tiếng Việt/Anh
🔸 **Dịch thuật**: Dịch giữa các ngôn ngữ phổ biến
🔸 **Tóm tắt**: Rút gọn nội dung, làm nổi bật ý chính
🔸 **Gợi ý ý tưởng**: Brainstorm, tạo outline cho bài viết

**Cách sử dụng**:
• Mô tả cụ thể yêu cầu của bạn
• Cung cấp văn bản cần xử lý (nếu có)
• Đặt câu hỏi chi tiết

Ví dụ: "Hãy cải thiện đoạn văn này: [văn bản của bạn]"

Bạn cần hỗ trợ gì cụ thể?"""

@bp.route('/chat', methods=['POST'])
@require_auth
def chat_with_ai(user):
    """Chat with AI assistant for document writing help"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        context = data.get('context', '').strip()
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Try different AI providers in order of preference
        providers_to_try = ['gemini', 'openai_compatible']
        
        for provider in providers_to_try:
            try:
                if provider == 'gemini' and AI_PROVIDERS['gemini']['api_key']:
                    response = call_gemini_api(message, context)
                    return jsonify({
                        'response': response,
                        'provider': 'gemini'
                    }), 200
                elif provider == 'openai_compatible':
                    response = call_openai_compatible_api(message, context)
                    return jsonify({
                        'response': response,
                        'provider': 'openai_compatible'
                    }), 200
            except Exception as e:
                print(f"Provider {provider} failed: {e}")
                continue
        
        # Fallback to rule-based responses
        response = generate_fallback_response(message, context)
        return jsonify({
            'response': response,
            'provider': 'fallback'
        }), 200
        
    except Exception as e:
        print(f"Chat API error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/providers', methods=['GET'])
@require_auth
def get_available_providers(user):
    """Get list of available AI providers"""
    available = []
    
    if AI_PROVIDERS['gemini']['api_key']:
        available.append('gemini')
    
    if AI_PROVIDERS['openai_compatible']['api_key'] != 'dummy':
        available.append('openai_compatible')
    
    available.append('fallback')  # Always available
    
    return jsonify({
        'providers': available,
        'default': available[0] if available else 'fallback'
    }), 200
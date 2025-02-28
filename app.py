import os
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OCR_API_KEY = os.getenv("OCR_API_KEY")  # Your API Ninjas OCR key

# Initialize Flask app
app = Flask(__name__, static_folder='static', static_url_path='')

def generate_with_gemini(prompt: str) -> dict:
    try:
        if not GEMINI_API_KEY:
            return {"success": False, "error": "GEMINI_API_KEY is not set"}
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Instruct Gemini to use LaTeX formatting for equations.
        full_prompt = f"""
        Solve the following math problem step by step and format all equations using LaTeX delimiters (e.g., \\( ... \\) or $$ ... $$):
        {prompt}
        Please show your work clearly, explaining each step, and provide the final answer.
        """
        
        response = model.generate_content(full_prompt)
        return {
            "success": True,
            "steps": [step.strip() for step in response.text.split('\n') if step.strip()],
            "result": response.text
        }
    except Exception as e:
        return {"success": False, "error": f"Error generating content: {str(e)}"}

def extract_text_from_image(image_file) -> dict:
    """
    Uses the API Ninjas Image to Text API to extract text from the given image.
    The image_file must be a JPEG or PNG file, and its size must be under 500KB for free tier users.
    """
    try:
        url = 'https://api.api-ninjas.com/v1/imagetotext'
        # Ensure the file pointer is at the beginning
        image_file.seek(0)
        files = {'image': image_file}
        headers = {'X-Api-Key': OCR_API_KEY}
        response = requests.post(url, files=files, headers=headers)
        
        if response.status_code != 200:
            return {"success": False, "error": "OCR API error: " + response.text}
        
        # The API returns a list of detections; each detection contains the detected text.
        result = response.json()
        extracted_text = " ".join([detection.get("text", "") for detection in result])
        
        if not extracted_text.strip():
            return {"success": False, "error": "No text detected in the image."}
        
        return {"success": True, "text": extracted_text}
    except Exception as e:
        return {"success": False, "error": f"OCR error: {str(e)}"}

@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

@app.route('/solve', methods=['POST'])
def solve_problem():
    try:
        input_type = request.form.get('input_type', 'text')
        problem = request.form.get('problem', '')
        
        if input_type == 'image':
            # If no text is provided, perform OCR using the uploaded file.
            extracted_text = request.form.get('extracted_text')
            if not extracted_text and 'file' in request.files:
                image_file = request.files['file']
                ocr_result = extract_text_from_image(image_file)
                if not ocr_result["success"]:
                    return jsonify({"success": False, "error": ocr_result["error"]}), 400
                problem = ocr_result["text"]
        
        if not problem:
            return jsonify({"success": False, "error": "No problem text provided"}), 400
        
        solution = generate_with_gemini(problem)
        if not solution["success"]:
            return jsonify({"success": False, "error": solution["error"]}), 500
        
        return jsonify(solution)
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY environment variable not set")
    if not OCR_API_KEY:
        print("WARNING: OCR_API_KEY environment variable not set")
    app.run(debug=True, host='0.0.0.0', port=5000)

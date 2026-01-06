import os
from flask import Flask, request, jsonify
import requests
from flask_cors import CORS 

app = Flask(__name__)
CORS(app)  

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    email_text = data.get("email", "")
    email_prompt = data.get("prompt", "")
    prompt = (f"{email_prompt} + {email_text}")

    try:
        print("🔍 Sending request to Groq API...")
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"
            },
            json={
                "model": "llama3-8b-8192",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3          #Adjusts the randomness of the response, lower values make it more deterministic
            },
            timeout=5 
        )

        result = response.json()
        
        result_text = result["choices"][0]["message"]["content"]
        errors = ""
        if response.status_code == 503:
            errors = "Internal API server error. Please try again later."
        elif response.status_code == 429:
            errors = "API rate limit exceeded. Please wait 24 hours before trying again."

        return jsonify({"result": result_text, "errors": errors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


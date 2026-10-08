"""
Hugging Face API Verification Script.
Run this script to test your Hugging Face API token and model connectivity:
    python backend/utils/test_hf.py
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

HF_API_TOKEN = os.getenv('HF_API_TOKEN', '').strip()
HF_MODEL = os.getenv('HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct').strip()

print("=" * 60)
print("  HUGGING FACE API CONNECTIVITY CHECK")
print("=" * 60)

if not HF_API_TOKEN or HF_API_TOKEN == 'your_huggingface_token_here':
    print("\n[!] HF_API_TOKEN is not configured in backend/.env")
    print("\nHow to get your FREE Hugging Face API Token:")
    print("  1. Go to https://huggingface.co/join and create a free account (if you don't have one).")
    print("  2. Visit https://huggingface.co/settings/tokens")
    print("  3. Click 'Create new token'.")
    print("  4. Choose 'Read' or 'Fine-grained' with 'Make calls to Inference Providers' permission.")
    print("  5. Copy your token (starts with 'hf_...').")
    print("  6. Paste it into backend/.env:")
    print("     HF_API_TOKEN=hf_your_actual_token_here")
    print("\nNote: The application includes intelligent fallback logic, so you can still")
    print("test and run full mock interviews even without a token!")
    sys.exit(0)

masked_token = HF_API_TOKEN[:4] + "..." + HF_API_TOKEN[-4:] if len(HF_API_TOKEN) > 8 else "***"
print(f"[*] Target Model : {HF_MODEL}")
print(f"[*] Loaded Token : {masked_token}")
print("[*] Testing connection to Hugging Face Router endpoint...")

endpoints = [
    ("Primary Router API", "https://router.huggingface.co/v1/chat/completions"),
    ("HF-Inference Router API", "https://router.huggingface.co/hf-inference/v1/chat/completions")
]

payload = {
    "model": HF_MODEL,
    "messages": [
        {"role": "system", "content": "You are a helpful technical interviewer. Return ONLY JSON."},
        {"role": "user", "content": 'Respond with JSON: {"status": "connected", "model": "' + HF_MODEL + '"}'}
    ],
    "temperature": 0.2,
    "max_tokens": 100
}

success = False
for name, url in endpoints:
    print(f"\n[*] Trying {name} ({url})...")
    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {HF_API_TOKEN}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            reply = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            print(f"[✓] SUCCESS! Response received from {HF_MODEL}:")
            print(f"    {reply.strip()}")
            success = True
            break
        else:
            print(f"[!] HTTP {response.status_code}: {response.text[:300]}")
    except Exception as e:
        print(f"[!] Connection failed: {e}")

if success:
    print("\n" + "=" * 60)
    print("  [✓] HUGGING FACE API IS FULLY FUNCTIONAL AND READY!")
    print("=" * 60)
else:
    print("\n" + "=" * 60)
    print("  [!] Connection could not be established with this token/model.")
    print("  Check token permissions at https://huggingface.co/settings/tokens")
    print("  (Make sure 'Make calls to Inference Providers' is checked).")
    print("=" * 60)

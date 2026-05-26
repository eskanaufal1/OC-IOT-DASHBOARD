"""
Chatbot response tester — runs varied queries in ID and EN, analyzes quality.
"""
import json
import time
import urllib.request

BASE = "http://localhost:8002/api/v1"
BODY = '{"question":"%s","session_id":""}'

def get_token():
    req = urllib.request.Request(f"{BASE}/auth/login",
        data=b'{"username":"admin","password":"admin123"}',
        headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())["token"]

def ask(token, question):
    req = urllib.request.Request(f"{BASE}/chat/query",
        data=BODY.replace("%s", question).encode(),
        headers={"Content-Type": "application/json",
                  "Authorization": f"Bearer {token}"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())["response"]
    except Exception as e:
        return f"ERROR: {e}"

EN_QUERIES = [
    "hello", "hi", "good morning", "thanks",
    "voltage?", "voltage 1?", "voltage 2?",
    "current?", "current 1?", "current 2?",
    "power?", "power 1?", "power 2?",
    "total power?", "total current?",
    "compare circuit 1 and 2",
    "what is the line balance?",
    "what is the load ratio?",
    "how much does circuit 1 cost per month?",
    "is the system healthy?",
    "any issues?",
    "what sensors do you monitor?",
    "list all sensors",
    "recommendations to save energy?",
    "which sensor is most unstable?",
    "what is the voltage range?",
    "how is current 1 doing?",
    "tell me about power",
    "energy consumption?",
    "what is the grid voltage?",
    "is voltage stable?",
    "how many sensors?",
    "what circuits?",
    "circuit 1 details",
    "circuit 2 details",
]

ID_QUERIES = [
    "halo", "hai", "selamat pagi", "terima kasih",
    "tegangan?", "tegangan 1?", "tegangan 2?",
    "arus?", "arus 1?", "arus 2?",
    "daya?", "daya 1?", "daya 2?",
    "total daya?", "total arus?",
    "bandingkan sirkuit 1 dan 2",
    "berapa keseimbangan tegangan?",
    "berapa rasio beban?",
    "berapa biaya sirkuit 1 per bulan?",
    "apakah sistem sehat?",
    "ada masalah?",
    "apa saja sensor yang dipantau?",
    "daftar semua sensor",
    "rekomendasi hemat energi?",
    "sensor mana yang paling tidak stabil?",
    "berapa rentang tegangan?",
    "bagaimana arus 1?",
    "ceritakan tentang daya",
    "konsumsi energi?",
    "berapa tegangan grid?",
    "apakah tegangan stabil?",
    "berapa jumlah sensor?",
    "sirkuit apa saja?",
    "detail sirkuit 1",
    "detail sirkuit 2",
]

def check_quality(response, question):
    issues = []
    r = response.lower()

    # Prompt leakage checks
    leak_words = ["terima kasih: sama-sama", "sapaan:", "aturan:",
                   "satu baris per sensor", "jangan jelaskan"]
    for w in leak_words:
        if w in r:
            issues.append(f"PROMPT_LEAK: {w}")

    # Safety fallback
    if "saya sudah memproses" in r or "saya sudah memproses" in r.lower():
        issues.append("SAFETY_FALLBACK")

    # Empty/short
    if len(response.strip()) < 3:
        issues.append("TOO_SHORT")
    if len(response.strip()) > 1000:
        issues.append("TOO_LONG")

    # Hallucination patterns
    if "circuit 3" in r or "sirkuit 3" in r:
        issues.append("HALLUCINATION: circuit 3")
    if "sensor 7" in r or "sensor 3" in r:
        issues.append("HALLUCINATION: extra sensor")

    # Wrong intent: greeting when asked sensor query
    if any(w in question.lower() for w in ["voltage", "tegangan", "current", "arus", "power", "daya"]):
        if "saya sensor ai" in r[:50] or "halo" in r[:20]:
            issues.append("WRONG_INTENT: greeting_for_sensor_query")

    return issues

def main():
    print("Getting token...")
    token = get_token()
    results = []

    for i, q in enumerate(EN_QUERIES + ID_QUERIES):
        time.sleep(2)  # rate limit
        resp = ask(token, q)
        issues = check_quality(resp, q)
        lang = "EN" if i < len(EN_QUERIES) else "ID"
        status = "OK" if not issues else "+".join(issues)
        results.append((lang, q, status, resp[:120]))
        print(f"[{lang}] {q:35s} -> {status:20s} | {resp[:80]}")

    print(f"\n=== SUMMARY ===")
    ok = sum(1 for _, _, s, _ in results if s == "OK")
    bad = sum(1 for _, _, s, _ in results if s != "OK")
    print(f"Total: {len(results)} | OK: {ok} | Issues: {bad}")

    for lang, q, s, _ in results:
        if s != "OK":
            print(f"  ISSUE [{lang}] {q}: {s}")


if __name__ == "__main__":
    main()

import hashlib
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util

app = FastAPI(title="SHC AI service")
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
cache, t5 = {}, None

def emb(text):
    k = hashlib.md5(text.encode()).hexdigest()
    if k not in cache:
        cache[k] = model.encode(text, convert_to_tensor=True)
    return cache[k]

class Art(BaseModel):
    id: int
    text: str

class MatchIn(BaseModel):
    text: str
    articles: list[Art]

@app.post("/match")
def match(m: MatchIn):
    q, best, score = emb(m.text), None, 0.0
    for a in m.articles:
        s = float(util.cos_sim(q, emb(a.text)))
        if s > score:
            best, score = a.id, s
    return {"id": best, "confidence": max(0, min(100, round(score * 100)))}

class QIn(BaseModel):
    text: str
    article: str

@app.post("/questions")
def questions(q: QIn):
    global t5
    out = ["Which application or service were you using when this happened?",
           "What exact error message did you see?"]
    try:
        if t5 is None:
            from transformers import pipeline
            t5 = pipeline("text2text-generation", model="t5-small")
        r = t5("generate question: " + q.article, max_new_tokens=32)[0]["generated_text"].strip()
        if r.endswith("?"):
            out.append(r[0].upper() + r[1:])
    except Exception:
        out.append("When did the problem start, and has it worked before?")
    return {"questions": out}

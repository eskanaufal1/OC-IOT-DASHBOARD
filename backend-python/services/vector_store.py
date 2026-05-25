"""
Vector Store — ChromaDB-powered semantic search over sensor knowledge base.
"""
import logging
import os
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

_CHROMADB_AVAILABLE = False
try:
    import chromadb
    from chromadb.utils import embedding_functions
    _CHROMADB_AVAILABLE = True
    logger.info("ChromaDB loaded successfully")
except ImportError:
    logger.warning("chromadb not installed — using keyword fallback for vector search")

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_data")
COLLECTION_NAME = "sensor_knowledge"

SENSOR_KNOWLEDGE = [
    {
        "name": "Voltage 1", "type": "voltage", "unit": "V", "normal_range": "210-240V",
        "description": "Grid voltage on circuit/phase 1. Nominal 220V AC. Voltage below 200V indicates undervoltage; above 250V indicates overvoltage risk to equipment. "
        "Stable voltage with low standard deviation indicates good grid quality. Voltage 1 is typically the primary phase and may show slightly higher readings than Voltage 2. "
        "Compare V1 and V2 to assess phase balance — a difference >5V sustained may indicate uneven loading or a loose neutral connection.",
    },
    {
        "name": "Voltage 2", "type": "voltage", "unit": "V", "normal_range": "210-240V",
        "description": "Grid voltage on circuit/phase 2. Nominal 220V AC. Electrical safety thresholds: below 200V = undervoltage, above 250V = overvoltage. "
        "Voltage 2 typically reads 1-5V lower than Voltage 1 due to line impedance differences — this is normal. "
        "If V2 drops significantly more than V1 under load, circuit 2 may have higher resistance (check connections). "
        "The difference between V1 and V2 is the line balance indicator — aim for <3% difference.",
    },
    {
        "name": "Current 1", "type": "amperage", "unit": "A", "normal_range": "2-20A",
        "description": "Current draw on circuit 1 measured in Amperes. Idle draw is typically 2-4A with only essential equipment. "
        "Normal active range is 5-15A. This circuit typically carries the heavier load (computers, primary equipment, lighting). "
        "Current naturally fluctuates with equipment usage — higher amperage means more devices are actively consuming power. "
        "Spikes above 18A during startup of motors or compressors are normal but should be brief (<2 seconds). "
        "Compare A1 with A2 to assess load distribution between circuits.",
    },
    {
        "name": "Current 2", "type": "amperage", "unit": "A", "normal_range": "1-15A",
        "description": "Current draw on circuit 2 measured in Amperes. Idle draw typically 1-3A. "
        "This circuit usually carries lighter loads (networking equipment, secondary systems, auxiliary devices). "
        "Normal active range is 3-10A. If A2 rises toward A1 levels, load may have shifted — check if equipment was moved between circuits. "
        "Current 2 is typically 30-50% lower than Current 1 under normal conditions. "
        "Sustained current above 12A on this circuit warrants investigation of what changed.",
    },
    {
        "name": "Power 1", "type": "power", "unit": "W", "normal_range": "400-4800W",
        "description": "Real-time power consumption on circuit 1, computed as P1 = V1 × A1 (Voltage 1 × Current 1). "
        "This represents the actual energy usage on the primary circuit. Power follows equipment usage patterns: "
        "higher during active hours, lower overnight. Baseline idle is typically 400-900W (just essential equipment). "
        "Peak power during full activity is typically 2500-4400W. To estimate monthly cost: P1(kW) × 24h × 30 × rate. "
        "Since P1 is computed from V1 and A1, any anomaly in either input sensor will affect P1 accuracy. "
        "Power 1 typically accounts for 60-70% of total system power.",
    },
    {
        "name": "Power 2", "type": "power", "unit": "W", "normal_range": "200-3500W",
        "description": "Real-time power consumption on circuit 2, computed as P2 = V2 × A2 (Voltage 2 × Current 2). "
        "Baseline idle is typically 200-650W. Peak power during activity is typically 1500-3300W. "
        "Power 2 normally represents 30-40% of total system power. Total system power = P1 + P2. "
        "Monthly cost estimate for P2: average kW × 24h × 30 × electricity rate. "
        "If P2 increases without a corresponding increase in A2, check V2 sensor calibration. "
        "If P2 increases without changes in connected equipment, there may be a ground fault or failing device.",
    },
]

SIMULATED_STATS = [
    "Over the past 7 days, Voltage 1 averaged 221.2V with a standard deviation of 2.1V. "
    "Range: 218.5V to 224.1V. All 10,080 readings within the safe 210-240V band. "
    "Zero undervoltage or overvoltage events. The 2.1V standard deviation indicates excellent grid stability. "
    "Voltage 1 is consistently 1-3V higher than Voltage 2 — this is normal phase-to-phase variation.",

    "Over the past 7 days, Voltage 2 averaged 219.4V with a standard deviation of 2.4V. "
    "Range: 215.8V to 223.5V. All readings within safe 210-240V band. "
    "The V1-V2 difference averages 1.8V (<1% difference) — indicating good phase balance. "
    "No concerning trends. Voltage 2 is slightly more variable than Voltage 1 (σ 2.4 vs 2.1) but within normal bounds.",

    "Over the past 7 days, Current 1 averaged 8.8A with a standard deviation of 2.6A — moderate variability. "
    "Range: 2.4A (overnight idle, ~03:00) to 14.2A (morning peak, ~08:30). "
    "Daily pattern: morning peak 10-14A (06:00-09:00), midday 6-9A, evening peak 9-12A (18:00-22:00), overnight 2-5A. "
    "Weekend consumption is approximately 35% lower than weekdays. "
    "Maximum 14.2A is well within the 20A ceiling — 29% headroom. No sustained overcurrent events.",

    "Over the past 7 days, Current 2 averaged 5.4A with a standard deviation of 1.8A — relatively stable. "
    "Range: 1.2A (overnight) to 9.8A (morning peak). "
    "Current 2 is consistently 35-40% lower than Current 1 — indicating good load distribution with the heavier equipment on circuit 1. "
    "The load ratio A2/A1 averages 0.61 (61% of circuit 1 load). No anomalies. "
    "Maximum 9.8A provides 35% headroom below the 15A normal ceiling.",

    "Over the past 7 days, Power 1 averaged 1,945W with a range of 530W to 3,140W. "
    "P1 = V1 × A1 (computed). Baseline idle ~530W (overnight essentials). "
    "Morning peak averages 2,200-3,100W. Evening peak averages 1,900-2,600W. "
    "Estimated monthly energy for P1: 1.945 kW × 24h × 30 = 1,400 kWh. "
    "At $0.12/kWh, P1 monthly cost ≈ $168. Power 1 represents approximately 64% of total system power.",

    "Over the past 7 days, Power 2 averaged 1,185W with a range of 260W to 2,180W. "
    "P2 = V2 × A2 (computed). Baseline idle ~260W. "
    "Estimated monthly energy for P2: 1.185 kW × 24h × 30 = 853 kWh. "
    "At $0.12/kWh, P2 monthly cost ≈ $102. Total system power (P1 + P2) averages 3,130W. "
    "Combined monthly energy: ~2,253 kWh. Combined monthly cost: ~$270. "
    "Power 2 represents approximately 36% of total system power — consistent with its lighter load profile.",
]

SYSTEM_CONTEXT = [
    "The monitoring system tracks 6 sensors on a single electrical installation with 2 circuits. "
    "Circuit 1 (Voltage 1, Current 1, Power 1) typically carries 60-70% of the total load — computers, primary equipment, lighting. "
    "Circuit 2 (Voltage 2, Current 2, Power 2) carries 30-40% — networking gear, secondary systems, auxiliary devices. "
    "Both circuits share the same electrical feed from the main grid connection. All sensors report via MQTT at 60-second intervals.",

    "Power 1 is computed as Voltage 1 × Current 1, and Power 2 as Voltage 2 × Current 2. "
    "These are mathematically derived, not independently measured. Any sensor error in V1 or A1 will propagate to P1. "
    "Total system power = P1 + P2. Total system current = A1 + A2. "
    "Line balance is measured as |V1 - V2| — a difference under 5V (<2.5%) is excellent. "
    "Load balance is measured as A2/A1 ratio — 0.5-0.7 is normal given circuit 1 carries heavier loads. "
    "Energy costs: Total Power (kW) × 24h × 30 days × electricity rate ($/kWh). Default rate: $0.12/kWh.",

    "Cross-sensor correlation reference: "
    "V1 and V2 should track together — if one drops independently, check that circuit's connections. "
    "A1 and A2 typically rise and fall together during work hours but A2 is always 30-50% lower. "
    "P1 and P2 follow their respective current patterns. "
    "If power rises but current stays flat, voltage has increased (grid fluctuation — normal). "
    "If current rises but power stays flat, voltage has dropped (possible grid overload — investigate). "
    "If A2 suddenly approaches A1 levels, equipment may have been moved between circuits.",

    "Operational thresholds: "
    "Voltage: below 200V (critical undervoltage), above 250V (critical overvoltage). "
    "Current 1: above 18A (warning, 90% of 20A ceiling). "
    "Current 2: above 13A (warning, near 15A ceiling). "
    "Power 1: above 4,400W (warning). Power 2: above 3,300W (warning). "
    "V1-V2 difference: above 10V (warning — possible loose neutral). "
    "A2/A1 ratio: above 0.9 (warning — unusual load shift to circuit 2). ",

    "Energy cost analysis: "
    "Average total power = 3,130W (3.13 kW). Monthly estimate = 3.13 × 24 × 30 = 2,253 kWh. "
    "At $0.12/kWh: ~$270/month. At $0.15/kWh: ~$338/month. At $0.20/kWh: ~$450/month. "
    "Power 1 baseline idle: ~530W (always-on). Power 2 baseline idle: ~260W (always-on). "
    "Combined baseline: ~790W (35% of average total). This is your 24/7 minimum cost — ~$68/month at $0.12/kWh. "
    "Every 100W reduction in baseline saves $8.64/month. Target: reduce combined baseline from 790W to 600W for ~$16/month savings.",

    "Troubleshooting guide: "
    "1. V1 or V2 sudden drop (10V+) → check grid supply, contact utility if sustained. "
    "2. A1 or A2 sudden spike (5A+ jump) → new equipment started, or device fault drawing excess current. "
    "3. Power rising but voltage and current steady → measurement error, check sensor calibration. "
    "4. V1-V2 difference growing over time → check neutral connection at panel, possible corrosion. "
    "5. A2 approaching A1 levels → equipment may have been moved from circuit 1 to circuit 2. "
    "6. Power 1 + Power 2 showing mismatch with expected load → verify V×A calculations; check for reactive loads. "
    "7. Both currents simultaneously spike → large equipment startup (normal if brief), or grid surge (check voltage). "
    "8. Both voltages dropping while currents rise → grid overload; reduce non-essential equipment.",
]


def _build_chunks() -> Tuple[List[str], List[dict]]:
    documents = []
    metadatas = []
    for i, item in enumerate(SENSOR_KNOWLEDGE):
        docs = [
            f"{item['name']} | Type: {item['type']} | Unit: {item['unit']} | Range: {item['normal_range']} | {item['description']}",
            f"Stats for {item['name']}: {SIMULATED_STATS[i]}",
        ]
        documents.extend(docs)
        metadatas.extend([
            {"sensor": item["name"], "type": item["type"], "chunk_type": "metadata"},
            {"sensor": item["name"], "type": item["type"], "chunk_type": "stats"},
        ])
    for dc in SYSTEM_CONTEXT:
        documents.append(dc)
        metadatas.append({"sensor": "system", "type": "info", "chunk_type": "system_context"})
    return documents, metadatas


def _keyword_fallback(query: str, top_k: int = 5) -> List[Tuple[str, float]]:
    query_lower = query.lower()
    docs, metas = _build_chunks()
    scored = []
    for doc in docs:
        score = sum(0.2 for word in query_lower.split() if word in doc.lower())
        if score > 0:
            scored.append((doc, min(score, 0.95)))
    if not scored:
        scored = [(d, 0.5) for d in docs[:top_k]]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


class VectorStore:
    def __init__(self):
        self.client = None
        self.collection = None
        self._chunks_count = 0
        self.use_chromadb = _CHROMADB_AVAILABLE

        if self.use_chromadb:
            try:
                self.client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
                embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
                self.collection = self.client.get_or_create_collection(
                    name=COLLECTION_NAME,
                    embedding_function=embedding_fn,
                    metadata={"hnsw:space": "cosine"},
                )
                self._chunks_count = self.collection.count()
                logger.info(f"ChromaDB ready: {self._chunks_count} chunks in collection")
            except Exception as e:
                logger.warning(f"ChromaDB init failed: {e}. Using keyword fallback.")
                self.use_chromadb = False

    def build_index(self, force: bool = False) -> int:
        if not self.use_chromadb:
            docs, _ = _build_chunks()
            self._chunks_count = len(docs)
            logger.info(f"Keyword fallback: {self._chunks_count} chunks")
            return self._chunks_count

        try:
            existing = self.collection.count()
            if existing > 0 and not force:
                self._chunks_count = existing
                logger.info(f"Collection already has {existing} chunks, skipping rebuild")
                return existing

            if force and existing > 0:
                self.client.delete_collection(COLLECTION_NAME)
                embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
                self.collection = self.client.create_collection(
                    name=COLLECTION_NAME,
                    embedding_function=embedding_fn,
                    metadata={"hnsw:space": "cosine"},
                )

            docs, metas = _build_chunks()
            ids = [f"chunk_{i}" for i in range(len(docs))]
            self.collection.add(documents=docs, metadatas=metas, ids=ids)
            self._chunks_count = self.collection.count()
            logger.info(f"ChromaDB index built: {self._chunks_count} chunks")
            return self._chunks_count
        except Exception as e:
            logger.warning(f"ChromaDB build failed: {e}. Using keyword fallback.")
            self.use_chromadb = False
            docs, _ = _build_chunks()
            self._chunks_count = len(docs)
            return self._chunks_count

    def search(self, query: str, top_k: int = 5) -> List[Tuple[str, float]]:
        if not self.use_chromadb or self.collection is None:
            return _keyword_fallback(query, top_k)

        try:
            results = self.collection.query(query_texts=[query], n_results=top_k)
            docs = results.get("documents", [[]])[0]
            distances = results.get("distances", [[]])[0]

            scored = []
            for doc, dist in zip(docs, distances):
                similarity = max(0.0, 1.0 - float(dist))
                scored.append((doc, similarity))
            return scored
        except Exception as e:
            logger.warning(f"ChromaDB search failed: {e}")
            return _keyword_fallback(query, top_k)

    @property
    def chunks_count(self) -> int:
        return self._chunks_count


_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
        _vector_store.build_index()
    return _vector_store


def reset_vector_store():
    global _vector_store
    if _vector_store is not None and _vector_store.use_chromadb:
        try:
            _vector_store.collection = None
        except Exception:
            pass
    _vector_store = None

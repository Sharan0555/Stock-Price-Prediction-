import os, json, logging
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)
MODELS_DIR = Path(__file__).parent.parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

_registry: dict = {}

def register(ticker: str, model, scalers: dict, cv_scores: list):
    _registry[ticker.upper()] = {'model': model, 'scalers': scalers, 'cv_scores': cv_scores}

def get(ticker: str):
    return _registry.get(ticker.upper())

def save(ticker: str):
    t = ticker.upper()
    entry = _registry.get(t)
    if not entry:
        return
    entry['model'].save(MODELS_DIR / f'{t}.keras')
    with open(MODELS_DIR / f'{t}_scalers.json', 'w') as f:
        json.dump(entry['scalers'], f)
    with open(MODELS_DIR / f'{t}_cv.json', 'w') as f:
        json.dump(entry['cv_scores'], f)
    logger.info(f'Saved model for {t}')

def load_all():
    import tensorflow as tf
    for keras_file in MODELS_DIR.glob('*.keras'):
        t = keras_file.stem
        scalers_file = MODELS_DIR / f'{t}_scalers.json'
        cv_file = MODELS_DIR / f'{t}_cv.json'
        if not scalers_file.exists():
            continue
        try:
            model = tf.keras.models.load_model(keras_file)
            with open(scalers_file) as f:
                scalers = json.load(f)
            cv_scores = json.load(open(cv_file)) if cv_file.exists() else []
            _registry[t] = {'model': model, 'scalers': scalers, 'cv_scores': cv_scores}
            logger.info(f'Loaded model for {t}')
        except Exception as e:
            logger.error(f'Failed to load {t}: {e}')

def list_tickers():
    return list(_registry.keys())

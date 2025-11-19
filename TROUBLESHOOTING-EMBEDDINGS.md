# Troubleshooting: Embedding Model Loading Issues

## Current Issue

The error "cannot read properties of undefined (reading 'create')" indicates that Transformers.js is loading from the CDN but failing to initialize the ONNX Runtime in Obsidian's Electron environment.

## Why This Happens

1. **Electron vs Browser**: Obsidian runs on Electron, which has different security restrictions than a web browser
2. **ONNX Runtime**: The AI model requires ONNX Runtime Web, which may not work in Electron
3. **CDN Loading**: Dynamic imports from CDNs may be blocked or restricted in Obsidian

## Potential Solutions

### Option 1: Check Obsidian Settings
1. Settings → Community Plugins → Enable "Allow loading content from external sites"
2. Restart Obsidian

### Option 2: Use OpenAI API Instead (Future)
Replace local embeddings with OpenAI's API:
- Costs ~$0.0001 per note
- More reliable
- No local dependencies
- Requires API key

### Option 3: Server-Based Embeddings (Future)
Run a local server with sentence-transformers:
```python
# Install: pip install sentence-transformers flask
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
# Create REST API
```

### Option 4: Simpler Keyword-Based Search (Fallback)
If embeddings don't work, we can fall back to:
- TF-IDF keyword similarity
- BM25 ranking
- No AI required, works everywhere

## Debug Information

To help debug, open Developer Console (`Cmd/Ctrl + Shift + I`) and look for:
1. "Transformers.js module loaded: [...]" - Shows what was imported
2. "Model download progress: ..." - Shows if model is downloading
3. Any red error messages with stack traces

## Current Status

The semantic search feature requires:
- ✅ Internet access
- ✅ CDN access (jsdelivr.net)
- ❌ ONNX Runtime Web working in Electron environment

The last requirement is currently failing in Obsidian.

## Next Steps

1. Try opening Developer Console and running the index again to see detailed error logs
2. Check if you see model download progress or if it fails immediately
3. Consider using one of the alternative solutions above

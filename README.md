# Obsidian Systematics Plugin

An Obsidian plugin for viewing and organizing notes systematically through complete graph (Kn) visualizations.

## Features

- **Graph Visualization**: Display complete graphs from K3 (triangle) to K12 (dodecagon)
- **Interactive Nodes**: Click on nodes to assign custom labels and link them to notes
- **Note Navigation**: Quickly navigate to linked notes directly from the graph view
- **Semantic Search**: AI-powered semantic search with monad visualization (requires embedding server)
- **Persistent Settings**: Your node labels and note links are saved across sessions
- **Beautiful Rendering**: Clean, responsive canvas-based visualization that adapts to your theme

## Installation

### Manual Installation

1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder named `obsidian-systematics` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Restart Obsidian
5. Go to Settings → Community Plugins and enable "Systematics"

### Development Installation

1. Clone this repository into your vault's `.obsidian/plugins/` directory:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone https://github.com/Joshfairhead/obsidian-systematics.git
   cd obsidian-systematics
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Restart Obsidian and enable the plugin in Settings → Community Plugins

## Semantic Search Setup (Optional)

The semantic search feature requires a local embedding server to be running:

1. **Get the embedding server**:
   ```bash
   git clone https://github.com/Joshfairhead/systematics-embeddings.git
   cd systematics-embeddings
   ```

2. **Setup and run** (see the [embedding server README](https://github.com/Joshfairhead/systematics-embeddings) for details):
   ```bash
   # Download the AI model (one-time setup)
   pip install optimum[exporters] transformers torch
   python download-model.py

   # Build and run the server
   cargo build --release
   ./target/release/systematics-embeddings
   ```

3. **Use semantic search** in Obsidian:
   - Click the magnifying glass icon (🔍) in the ribbon
   - Click "Index Vault" to index your notes
   - Search semantically by concepts and ideas!

The server runs locally on your machine - no cloud services, no API costs.

## Usage

### Opening the Graph View

There are three ways to open the Systematics Graph view:

1. Click the graph icon (🔀) in the left ribbon
2. Use the Command Palette (Ctrl/Cmd+P) and search for "Open Systematics Graph"
3. The view will open in the right sidebar by default

### Working with Graphs

1. **Select a Graph**: Use the dropdown menu to choose from K3 to K12
   - K3: Triangle (3 nodes, 3 edges)
   - K4: Tetrahedron projection (4 nodes, 6 edges)
   - K5: Pentagon (5 nodes, 10 edges)
   - And so on up to K12 (12 nodes, 66 edges)

2. **Customize Node Labels**:
   - Click on any node to open the context menu
   - Select "Set label" to give it a meaningful name (e.g., "Product", "Governance", "Development")

3. **Link to Notes**:
   - Click on a node and select "Link to note"
   - Enter the path to your note (e.g., `projects/product.md`)
   - Linked nodes will appear in blue

4. **Open Linked Notes**:
   - Click on a node with a linked note
   - Select "Open linked note" from the context menu
   - The note will open in the main workspace

### Example: K3 Graph for Product Development

For a K3 (triangle) graph, you might label the three nodes as:
- **Node 0**: "Product" → linked to `product-vision.md`
- **Node 1**: "Governance" → linked to `governance-model.md`
- **Node 2**: "Development" → linked to `dev-process.md`

The complete graph structure ensures that all three aspects are interconnected, representing their interdependencies.

## Graph Types

The plugin uses normalized geometry data for each complete graph:

- **K3-K9**: Common sizes with semantic labels from the SystematicsAPI
- **K10-K12**: Larger graphs with generic node labels (customizable by you)

Each Kn graph is a complete graph where every node is connected to every other node, representing full interconnectedness.

## Settings

Access plugin settings via Settings → Systematics:

- **Default Graph**: Choose which graph (K3-K12) displays when you first open the view
- **Node Label Settings**: Automatically saved per graph type

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Development mode (watches for changes)
npm run dev

# Production build
npm run build
```

### Project Structure

```
obsidian-systematics/
├── src/
│   ├── types.ts          # TypeScript type definitions
│   ├── graphData.ts      # Graph geometry data (K3-K12)
│   └── graphView.ts      # Main view component
├── main.ts               # Plugin entry point
├── styles.css            # Plugin styles
├── manifest.json         # Obsidian plugin manifest
└── package.json          # Node.js package configuration
```

## Data Source

The graph geometries are based on the [SystematicsAPI](https://github.com/Joshfairhead/SystematicsAPI-v0.0.2) project, which provides normalized topology and geometry data for complete graphs.

## Future Enhancements

Potential features for future versions:

- K1 and K2 graph support with specialized representations
- 3D graph visualization for higher-order graphs
- Graph annotations and edge labels
- Export graph as image
- Multiple graph views in the same workspace
- Graph templates for common use cases
- Bulk note creation from graph structure

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Author

Josh Fairhead

## Acknowledgments

- Graph geometry data from [SystematicsAPI](https://github.com/Joshfairhead/SystematicsAPI-v0.0.2)
- Built for [Obsidian](https://obsidian.md)

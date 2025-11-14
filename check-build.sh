#!/bin/bash
# Debug script to verify the built plugin has the correct code

echo "Checking for black text color in main.js..."
if grep -q '#000000' main.js; then
    echo "✓ Black text color found"
else
    echo "✗ Black text color NOT found"
fi

echo ""
echo "Checking for white background in main.js..."
if grep -q 'rgba(255, 255, 255' main.js; then
    echo "✓ White background found"
else
    echo "✗ White background NOT found"
fi

echo ""
echo "Checking latest git commit..."
git log --oneline -1

echo ""
echo "Build date of main.js:"
ls -lh main.js

echo ""
echo "If both checks pass, the build is correct."
echo "Make sure to reload Obsidian after copying this file!"

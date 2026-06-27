#!/bin/bash
# Download speaker diarization models for sherpa-onnx-node
# Requires: curl, tar
set -e

MODELS_DIR="$(dirname "$0")/../data/models"
mkdir -p "$MODELS_DIR"

echo "Downloading pyannote segmentation model (6.8MB)..."
curl -SL -o "$MODELS_DIR/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"
tar xvf "$MODELS_DIR/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2" -C "$MODELS_DIR"
rm "$MODELS_DIR/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"

echo "Downloading 3D-Speaker embedding model (37.7MB)..."
curl -SL -o "$MODELS_DIR/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"

echo "✅ Models downloaded to $MODELS_DIR"
echo ""
echo "To verify:"
echo "  ls -lh $MODELS_DIR/sherpa-onnx-pyannote-segmentation-3-0/model.onnx"
echo "  ls -lh $MODELS_DIR/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"

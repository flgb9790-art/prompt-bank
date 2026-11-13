# MediaPipe face detector (full range, TFJS)

Official TensorFlow/MediaPipe model, bundled for offline CPU inference. No photo
or facial landmarks are sent to a detection service. Only eye coordinates and
the face box are used transiently to crop and level an identity reference; no
face recognition, embeddings or biometric database is built.

Source: https://tfhub.dev/mediapipe/tfjs-model/face_detection/full/1
Implementation: https://github.com/tensorflow/tfjs-models/tree/master/face-detection
License: Apache-2.0 (see LICENSE).

Files downloaded 2026-11-13:

- `model.json`: model graph and manifest.
- `group1-shard1of1.bin`: 1,026,192 bytes; SHA-256
  `5c3f885a2fd36cb36a6e8bf96a902d9702d486dc76454536e7c15ba73c4e5b42`.

The application loads these files from `backend/models/face-detection` with an
in-memory IO handler, without TFHub downloads at runtime. Keep this directory
when packaging the backend. CPU inference is loaded lazily.

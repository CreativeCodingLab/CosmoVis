#!/bin/bash
cd /cv-vol/dev-repo/CosmoVis
git-lfs fetch
git-lfs pull

systemctl daemon-reload
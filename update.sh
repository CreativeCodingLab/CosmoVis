#!/bin/bash
cd /cv-vol/dev-repo/CosmoVis
git-lfs stash

git-lfs fetch
git-lfs pull
git stash

git fetch
git pull

systemctl daemon-reload
systemctl start cosmovis.service

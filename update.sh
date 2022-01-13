#!/bin/bash
cd /cv-vol/main-repo/CosmoVis
git-lfs stash

git-lfs fetch
git-lfs pull
git stash

git fetch
git pull

systemctl daemon-reload
celery worker -A celery_tasks.celery --loglevel=info -P eventlet
systemctl start cosmovis.service

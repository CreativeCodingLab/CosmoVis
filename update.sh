#!/bin/bash

git fetch
git reset origin/master --hard

git pull

systemctl daemon-reload
cd /cv-vol/main-repo/CosmoVis/src/yt
python setup.py develop
pip install yt_astro_analysis
# cd /cv-vol/dev-repo/src/yt-astro-analysis
# pip install -e .

echo -e "y\n\n2\n" | python install_trident.py &

#start message broker
systemctl start rabbitmq-server

#set user permissions for message queue
rabbitmqctl add_user cosmovis sivomsoc
rabbitmqctl set_user_tags cosmovis administrator
rabbitmqctl set_permissions -p / cosmovis ".*" ".*" ".*"

#soft reload to update dependency tree
systemctl daemon-reload

#start celery worker
cd /cv-vol/main-repo/CosmoVis/
celery worker -A celery_tasks.celery --loglevel=info -P eventlet &
systemctl restart nginx
#start Flask application
systemctl start cosmovis.service

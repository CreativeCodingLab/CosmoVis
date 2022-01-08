#import trident for the first time -- initialization automation
echo -e "y\n\n2\n" | python install_trident.py
#soft reload to update dependency tree
systemctl daemon-reload

#start message broker
systemctl start rabbitmq-server

#set user permissions for message queue
rabbitmqctl add_user cosmovis sivomsoc
rabbitmqctl set_user_tags cosmovis administrator
rabbitmqctl set_permissions -p / cosmovis ".*" ".*" ".*"

#start celery worker
cd /cv-vol/dev-repo/CosmoVis/
celery worker -A celery_tasks.celery --loglevel=info -P eventlet &

#start Flask application
systemctl start cosmovis.service
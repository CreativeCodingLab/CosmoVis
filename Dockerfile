FROM dhna/mpi4py:latest

RUN apt-get update -y && \
    apt-get upgrade -y

RUN apt install -y build-essential
RUN apt install -y python3-dev
RUN apt install -y nginx
RUN apt install -y systemctl
RUN apt install -y s3fs
RUN apt-get -o Dpkg::Options::='--force-confmiss' install --reinstall -y netbase
RUN python -m pip install --upgrade pip
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY scripts/default /etc/nginx/sites-enabled/
COPY scripts/cosmovis.service /etc/systemd/system/
RUN systemctl dameon-reload
RUN systemctl enable cosmovis
RUN systemctl restart nginx

COPY . /cv-docker
WORKDIR /cv-docker

EXPOSE 5000

CMD [ "python", "./cosmo-serv.py" ]
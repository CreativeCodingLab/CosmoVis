FROM dhna/mpi4py:latest

RUN apt-get update -y && \
    apt-get upgrade -y

RUN apt install -y build-essential
RUN apt install -y python3-dev
RUN apt-get -o Dpkg::Options::='--force-confmiss' install --reinstall -y netbase
RUN python -m pip install --upgrade pip
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . /cv-docker
WORKDIR /cv-docker

EXPOSE 5000

CMD [ "python", "./cosmo-serv.py" ]
# Welcome to CosmoVis!

![screenshot of cosmovis](screenshot.png)

We introduce CosmoVis, an open-source web-based astrophysics visualization tool that facilitates the interactive analysis of large-scale hydrodynamic cosmological simulation datasets. CosmoVis enables astrophysicists as well as citizen scientists to share and explore these datasets, which are often comprised of complex, unwieldy data structures greater than 1 TB in size. Our tool visualizes a range of salient gas, dark matter, and stellar attributes extracted from the source simulations, and enables further analysis of the data using observational analogues, specifically absorption line spectroscopy. CosmoVis introduces novel analysis functionality through the use of **virtual skewers** that define a sightline through the volume to quickly obtain detailed diagnostics about the gaseous medium along the path of the skewer, including synthetic spectra that can be used to make direct comparisons with observational datasets. We identify the main analysis tasks that CosmoVis enables, and evaluate the software by presenting a series of contemporary scientific use cases that utilize CosmoVis. Additionally, we conduct a series of task-based interviews with astrophysicists indicating the usefulness of CosmoVis for a range of data analysis tasks.

A live demo can be found here: [CosmoVis](http://cosmovis.nrp-nautilus.io)

A dev demo with experimental features can be found here: [CosmoVis](http://cosmovis-dev.nrp-nautilus.io)

Here is a video that outlines a scientific use case from CosmoVis: [link](https://drive.google.com/file/d/1CPoEFf4xyQHr0zxEZMu_VgkT2a0_Nfme/view?usp=sharing)

## Reproducibility Stamp Installation Instructions

CosmoVis can be configured to run locally or remotely on a server, but the most simple way is to have it run locally. Hosting has the benefit of being able to access the visualization from other devices, and only takes a few extra steps to configure. CosmoVis has been tested on Windows, Linux and Mac. SIMULATION SNAPSHOTS ARE NOT INCLUDED IN THIS DEMO DUE TO SIZE. REGARDLESS, THE VOLUME RENDERING IS STILL ACCESSIBLE FOR THE 100 Mpc EAGLE BOX, HOWEVER, SPECTRA/COLUMN DENSITIES CANNOT BE GENERATED.

1.  **Clone the TVCG2022 branch of the CosmoVis repository**  

    NOTE: May require git-lfs. See install instructions: [https://git-lfs.github.com/](https://git-lfs.github.com/)        
    `git lfs clone https://github.com/CreativeCodingLab/CosmoVis.git -b TVCG2022`  
     
2.  **Install Python 3.7+ and dependencies**  
      
    `cd path/to/CosmoVis/`  
    `pip install -r requirements.txt`  
     
3.  **Start CosmoVis in a shell environment (CMD / Terminal)**  
      
    In the CosmoVis directory, run:  
    `python cosmo-serv.py`
     
4.  **Access CosmoVis in your web browser**  
      
    Navigate to https://localhost:5000  
    NOTE: It might not work if your web browser does not support WebGL 2.0.  
     

## Usage

*   CosmoVis enables real time volume rendering in the web browser. Try it out by clicking and dragging within the visualization. Use your mouse or trackpad scrolling to zoom in and out of the simulation.
*   On the right, click on the "data selection" to open a panel that allows for switching between simulations, changing the resolution, and slicing the volume.

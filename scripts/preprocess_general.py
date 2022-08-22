#!/usr/bin/env python
# coding: utf-8
# FARHANUL HASAN (farhasan@nmsu.edu)

### CosmoVis Data Preprocessing - make PartType files

from matplotlib import pyplot as plt
# from IPython import get_ipython
# get_ipython().run_line_magic('matplotlib', 'inline')
import numpy as np
import yt
import trident
import eagleSqlTools as sql
import numpy as np
import yt.units as units
from yt.visualization.volume_rendering.api import PointSource
from yt.units import kpc
import pylab
import json
import math
from math import log10, floor
import sys,os
import time
from astropy.io import ascii
import logging
import random

#Set log options here:

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO,filemode='w')

logfile = str(sys.argv[1])

# Set log file output
handler = logging.FileHandler(logfile,'w')
handler.setLevel(logging.INFO)

# Create a logging format
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

# Add the handlers to the logger
logger.addHandler(handler)


################## ################## Functions for preprocessing ##################
################## ################## ##################

#NEW (GENERAL)

def extractFeatures(ds,simpath,sim_type,resolution_list,field_list,percent_stars,left_edge,right_edge,haloid,galcenter,galspin):
    #simpath : local path to 1st hdf5 sim file
    #sim_type: 'EAGLE' or 'TNG' (add others as they come)

    enableParallelism()
    
    # print('for halo', haloid)
#     verifyTrident()
    # print('LOADING DATA')
    # ds = loadData(simpath)  #something we can do outside the loop

    # print('EXTRACTING FIELD LIST')
    # fl = getFieldList(ds)
    # print('GENERATING VOXEL GRIDS')
    glist = generateVoxelGrid(simpath,ds,resolution_list,field_list,sim_type,left_edge,right_edge,haloid)
    logger.info("=====Voxelized grids generated for halo {} =====".format(haloid))   
    # print('EXPORTING STARS')
    exportStars(simpath,ds,percent_stars,sim_type,left_edge,right_edge,haloid)
    # print('WRITING METADATA')
    exportSimMetadata(simpath,left_edge,right_edge,haloid,galcenter,galspin)
    return glist


def enableParallelism():
    #Note: Requires MPI to be installed on machine
    yt.enable_parallelism()

def verifyTrident():
    trident.verify()

def loadData(filename):
    fn = 'static/data/' + str(filename) + '/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
#     fn = filename
    print(fn)
    ds = yt.load(fn)
    return ds

def getFieldList(ds):
    fl = sorted(ds.field_list)
    # print(sorted(fl))
    df = ds.derived_field_list
    # print(sorted(df))
    return fl


def generateVoxelGrid(simpath,ds,resolution_list,field_list,sim_type,left_edge,right_edge,haloid):
    # simpath
    # resolution_list: list of resolutions to create, ex: [64,128,512] or [512]
    # field_list: list of particle fields to preprocess, ex: [['PartType0','Temperature'],['PartType0','Density'],['PartType1','Density']]
    fieldgridlist = []
    for j in range(len(resolution_list)):
        fieldgrids = []
        for i in range(len(field_list)):
            size = resolution_list[j]
            obj = createGrid(ds,size,field_list[i][1],left_edge,right_edge)
            grid = preprocessAttribute(simpath,obj,size,field_list[i][0],field_list[i][1],sim_type,haloid)
            fieldgrids.append(grid)
        fieldgridlist.append(fieldgrids)
    return fieldgridlist

    

def createGrid(ds,size,attr,left_edge,right_edge):

    logger.info("creating grid for {} - {}^3 particles".format(attr,size))
    
#     left_edge = left_edge * ds.length_unit.in_units("kpc")
#     right_edge = right_edge * ds.length_unit.in_units("kpc")

    left_edge = ds.arr(left_edge, "Mpc")
    right_edge = ds.arr(right_edge, "Mpc")
    
    if attr == 'PartType1_density':
        obj = ds.smoothed_covering_grid(2, left_edge=left_edge, dims=[size,size,size])
    else:
        obj = ds.arbitrary_grid(left_edge, right_edge, dims=[size, size, size])
    return obj


def preprocessAttribute(simpath,obj,size,particle_type,attribute,sim_type,haloid):
#     print(size)
    elements = ['PartType1_count', 'PartType1_density', 'PartType1_mass','Hydrogen','Helium','Carbon','Nickel','Oxygen','Neon','Magnesium','Silicon','Iron']
    try:
#         print('EXTRACTING: ' + particle_type + ', ' + attribute)
        f = obj[particle_type, attribute]
        if str(f.units) == 'code_mass':
            attr = np.float32(np.array(f.in_units('Msun')))
            units = 'Msun'
        elif str(f.units) == 'K':
            attr = np.float32(np.array(f))
            units = 'K'
        elif str(f.units) == 'code_mass/code_length**3':
            attr = np.float32(np.array(f.in_cgs()))
            units = f.in_cgs().units
        elif str(f.units) == '(dimensionless)':
            attr = np.float32(np.array(f))
            units = 'dimensionless'
        else:
            attr = np.float32(np.array(f.in_cgs()))
            units = f.in_cgs().units
        if attribute == "Metallicity" or attribute == "GFM_Metallicity":
            attr = np.float32(np.array(f.in_units("Zsun")))
            units = 'Zsun'
#         print(attribute,units)

        if attribute in elements:
            out = compressVoxelData(attr.tolist(),size,particle_type,attribute)

        else:
            out = transformVoxelData(attr)
            out = compressVoxelData(out,size,particle_type,attribute)

        with open( 'static/data/'+str(simpath) + '/Halos/halo_' + str(haloid) + '/' + particle_type + '/' + str( size ) + '_' + particle_type + '_' + attribute + '.json', 'w' ) as file:
            json.dump( out, file, separators=(',', ':') ) 

    except Exception as e:
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno)
        
    return attr   

def transformVoxelData(voxelized_data):
    out = np.log10(voxelized_data.tolist())
    return out.tolist()

def compressVoxelData(voxelized_data,size,particle_type,attribute):
    
    # scale data to [a,b]=[1,255] range (UInt8)
    # reserve val=0 when voxel=-Infinity (artefact from taking log10(0))
    a = 1
    b = 255
    
    # find min and max value (after log10) that is not -Infinity or Infinity
    try:
        max_val = -np.inf
        min_val =  np.inf
        # print(voxelized_data[0].shape)

        maxv = np.max(voxelized_data)
        minv = np.nanmin(voxelized_data)
        
        # voxelized_data.flatten()

        if max_val < maxv:
            max_val = maxv
        if min_val > minv:
            min_val = minv
        
#         print(max_val)

        if particle_type == 'PartType0':
            if attribute == 'Temperature':
                min_val = 1.0
                max_val = 8.0
            # if attribute == 'Carbon':
            #     min_val = 0.0001
            #     max_val = 0.001
            # if attribute == 'Oxygen':
            #     min_val = 0.0001
            #     max_val = 0.001
            if attribute == 'Density':
                min_val = -33.0
                max_val = -24.0
            if attribute == 'Entropy':
                min_val = -1.0
                max_val = 6.0
            if attribute == 'Metallicity':
                min_val = -5.0
                max_val = 1.0
            if attribute == 'H_number_density':
                min_val = -8.5
                max_val = 1.0

        out = voxelized_data.copy()
        for i in range(size):
            for j in range(size):
                for k in range(size):

                    # if voxel > -Infinity
                    if (not math.isinf(voxelized_data[i][j][k])) and (int(voxelized_data[i][j][k]) != 0):
                        # scale data between [a,b]
                        # multiply by 1000 to capture decimal precision into UInt8
                        # convert from float to int
                        out[i][j][k] = int( ( ( b - a ) * ( (voxelized_data[i][j][k] - min_val ) / ( max_val - min_val ) ) ) + a )
                        if float(out[i][j][k]) < 1.0:
                            out[i][j][k] = int(0)
                    else: # reserve val=0 when voxel=-Infinity (artefact from taking log10(0))
                        out[i][j][k] = int(0)
    except Exception as e:
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    return out


def exportStars(simpath,ds,percent,sim_type,left_edge,right_edge,haloid):
    # percent: % of number of particles to export between (0,100)

    ad=ds.r[ds.quan(left_edge[0], "Mpc"):ds.quan(right_edge[0],"Mpc"), ds.quan(left_edge[1], "Mpc"):ds.quan(right_edge[1],"Mpc"), ds.quan(left_edge[2], "Mpc"):ds.quan(right_edge[2],"Mpc")]   
    
    index = np.random.randint(0,len(ad['PartType4', 'Coordinates']),size=int(len(ad['PartType4', 'Coordinates'])*(percent/100)))
    star_particles = {}

    for i in range(0,int(len(index)-1)):
        j = index[i]
        if sim_type == 'EAGLE':
            star_particles[i] = (
                                    round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
                                    round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
                                    round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
                                    int(ad['PartType4', 'GroupNumber'][j]), # group ID
                                    round(float(np.log10(ad['PartType4', 'Mass'][j].in_units('Msun'))),2) # stellar mass
                                )
        if sim_type == 'TNG':
            star_particles[i] = (
                                    round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
                                    round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
                                    round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
                                    int(ad['PartType4', 'ParticleIDs'][j]), # group ID
                                    round(float(np.log10(ad['PartType4', 'Masses'][j].in_units('Msun'))),2) # stellar mass
                                )

    with open('static/data/'+ str(simpath) + '/Halos/halo_' + str(haloid) + '/PartType4/star_particles.json', 'w') as file:
        json.dump(star_particles, file, separators=(',', ':') )
    # print("exported {} stars".format(len(index)))

    logger.info("=====exported {} stars=====".format(len(index)))   
        

def exportSimMetadata(simpath,left_edge,right_edge,haloid,galcenter,galspin):
        
    fields2 = [["PartType0", "AExpMaximumTemperature"], ["PartType0", "Carbon"], ["PartType0", "Coordinates"], ["PartType0", "Density"], ["PartType0", "Entropy"], ["PartType0", "GroupNumber"], ["PartType0", "Helium"], ["PartType0", "HostHalo_TVir_Mass"], ["PartType0", "Hydrogen"], ["PartType0", "InternalEnergy"], ["PartType0", "Iron"], ["PartType0", "IronMassFracFromSNIa"], ["PartType0", "Magnesium"], ["PartType0", "Mass"], ["PartType0", "MaximumTemperature"], ["PartType0", "MetalMassFracFromAGB"], ["PartType0", "MetalMassFracFromSNII"], ["PartType0", "MetalMassFracFromSNIa"], ["PartType0", "Metallicity"], ["PartType0", "Neon"], ["PartType0", "Nitrogen"], ["PartType0", "OnEquationOfState"], ["PartType0", "Oxygen"], ["PartType0", "ParticleIDs"], ["PartType0", "Silicon"], ["PartType0", "SmoothedIronMassFracFromSNIa"], ["PartType0", "SmoothedMetallicity"], ["PartType0", "SmoothingLength"], ["PartType0", "StarFormationRate"], ["PartType0", "SubGroupNumber"], ["PartType0", "Temperature"], ["PartType0", "TotalMassFromAGB"], ["PartType0", "TotalMassFromSNII"], ["PartType0", "TotalMassFromSNIa"], ["PartType0", "Velocity"], ["PartType1", "Coordinates"], ["PartType1", "GroupNumber"], ["PartType1", "Mass"], ["PartType1", "ParticleIDs"], ["PartType1", "SubGroupNumber"], ["PartType1", "Velocity"], ["PartType4", "AExpMaximumTemperature"], ["PartType4", "BirthDensity"], ["PartType4", "Carbon"], ["PartType4", "Coordinates"], ["PartType4", "Feedback_EnergyFraction"], ["PartType4", "GroupNumber"], ["PartType4", "Helium"], ["PartType4", "HostHalo_TVir"], ["PartType4", "HostHalo_TVir_Mass"], ["PartType4", "Hydrogen"], ["PartType4", "InitialMass"], ["PartType4", "Iron"], ["PartType4", "IronMassFracFromSNIa"], ["PartType4", "Magnesium"], ["PartType4", "Mass"], ["PartType4", "MaximumTemperature"], ["PartType4", "MetalMassFracFromAGB"], ["PartType4", "MetalMassFracFromSNII"], ["PartType4", "MetalMassFracFromSNIa"], ["PartType4", "Metallicity"], ["PartType4", "Neon"], ["PartType4", "Nitrogen"], ["PartType4", "Oxygen"], ["PartType4", "ParticleIDs"], ["PartType4", "PreviousStellarEnrichment"], ["PartType4", "Silicon"], ["PartType4", "SmoothedIronMassFracFromSNIa"], ["PartType4", "SmoothedMetallicity"], ["PartType4", "SmoothingLength"], ["PartType4", "StellarEnrichmentCounter"], ["PartType4", "StellarFormationTime"], ["PartType4", "SubGroupNumber"], ["PartType4", "TotalMassFromAGB"], ["PartType4", "TotalMassFromSNII"], ["PartType4", "TotalMassFromSNIa"], ["PartType4", "Velocity"], ["PartType5", "BH_CumlAccrMass"], ["PartType5", "BH_CumlNumSeeds"], ["PartType5", "BH_Density"], ["PartType5", "BH_FormationTime"], ["PartType5", "BH_Mass"], ["PartType5", "BH_Mdot"], ["PartType5", "BH_MostMassiveProgenitorID"], ["PartType5", "BH_Pressure"], ["PartType5", "BH_SoundSpeed"], ["PartType5", "BH_SurroundingGasVel"], ["PartType5", "BH_TimeLastMerger"], ["PartType5", "Coordinates"], ["PartType5", "GroupNumber"], ["PartType5", "HostHalo_TVir_Mass"], ["PartType5", "Mass"], ["PartType5", "ParticleIDs"], ["PartType5", "SmoothingLength"], ["PartType5", "SubGroupNumber"], ["PartType5", "Velocity"], ["all", "Coordinates"], ["all", "GroupNumber"], ["all", "Mass"], ["all", "ParticleIDs"], ["all", "SubGroupNumber"], ["all", "Velocity"], ["nbody", "Coordinates"], ["nbody", "GroupNumber"], ["nbody", "Mass"], ["nbody", "ParticleIDs"], ["nbody", "SubGroupNumber"], ["nbody", "Velocity"]]
    
    #######   SPIN INFO        
    #######

    contents = {"left_edge": left_edge, "right_edge": right_edge, "star_center": galcenter, "star_spin": galspin, "field_list": fields2}
    
    with open('static/data/'+ str(simpath) + '/Halos/halo_' + str(haloid) + '/' +  '/simMetadata.json', 'w') as file:
        json.dump(contents,file)
#         json.dump(field_list, file)
        
################## ################## ################## ################## 
################## ################## ##################

#import halo catalogs:

EAGLE12, EAGLE25, EAGLE100 = 'RefL0012N0188', 'RefL0025N0376', 'RefL0100N1504'

halocat_12 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE12)+'.txt')
halocat_25 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE25)+'.txt')
halocat_100 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'.txt')

halocat_100_highmh = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'_m13'+'.txt')
halocat_100_midmh = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'_m12'+'.txt')


# list of voxel grid resolutions to export (creates cubes based on specified edge length)
resolution_list = [128,256]
# resolution_list = [64]

field_list = [('PartType0','Temperature'),('PartType0','Density'),('PartType0','Entropy'),('PartType0','Metallicity'),('PartType0', 'H_number_density')]

# percent of star particles to export (takes a random sampling)
# star_percent = 100 # set to zero because it has already been exported

logger.info("=============LOADING IN DATA ============")

ds = loadData(EAGLE100)
# print('EXTRACTING FIELD LIST')
fl = getFieldList(ds)

logger.info("=============DATA LOADED ============")


######### ######### MAKE PARTTYPE FILES FOR ALL HALOS ######### ######### 
######### ######### ######### ######### ######### ######### ######### 

# For loop - 100 Mpc halos

# rhMult = 2  #multiplier of Rh for box half width


# print('STARTING LOOP')

#random list:

# randhalo = random.sample(list(halocat_100),1000)


logger.info("=============STARTING LOOP ============")


startTime = time.time()

print(time.gmtime(startTime))


for i in range(len(halocat_100_highmh)):
# for i in range(len(halocat_100_midmh)):

# for i in range(3):

    # ###### Mh > 13 ######
    thishalo_id, thishalo_mh, thishalo_rh = halocat_100_highmh['haloID'][i], halocat_100_highmh['mh'][i], (halocat_100_highmh['rh'][i])/1000
    
    thishalo_x, thishalo_y, thishalo_z = halocat_100_highmh['halo_x'][i], halocat_100_highmh['halo_y'][i], halocat_100_highmh['halo_z'][i]

    #### for spin:
    thishalo_gx, thishalo_gy, thishalo_gz = halocat_100_highmh['gal_x'][i], halocat_100_highmh['gal_y'][i], halocat_100_highmh['gal_z'][i]
    thishalo_galcenter = [thishalo_gx, thishalo_gy, thishalo_gz]

    thishalo_sx, thishalo_sy, thishalo_sz = halocat_100_highmh['spin_x'][i], halocat_100_highmh['spin_y'][i], halocat_100_highmh['spin_z'][i]
    thishalo_galspin = [thishalo_sx, thishalo_sy, thishalo_sz]


    logger.info("=============In halo {}, ID {}, mh = {}x10^13 \n ============".format(i+1,thishalo_id,round(float(thishalo_mh)/1e13,2)))
    
    ######  ######  ######

    ###### Mh = 12-13 ######
    # thishalo_id, thishalo_mh, thishalo_rh = halocat_100_midmh['haloID'][i], halocat_100_midmh['mh'][i], (halocat_100_midmh['rh'][i])/1000
    
    # thishalo_x, thishalo_y, thishalo_z = halocat_100_midmh['halo_x'][i], halocat_100_midmh['halo_y'][i], halocat_100_midmh['halo_z'][i]
    
    # #### for spin:
    # thishalo_gx, thishalo_gy, thishalo_gz = halocat_100_midmh['gal_x'][i], halocat_100_midmh['gal_y'][i], halocat_100_midmh['gal_z'][i]
    # thishalo_galcenter = [thishalo_gx, thishalo_gy, thishalo_gz]

    # thishalo_sx, thishalo_sy, thishalo_sz = halocat_100_midmh['spin_x'][i], halocat_100_midmh['spin_y'][i], halocat_100_midmh['spin_z'][i]
    # thishalo_galspin = [thishalo_sx, thishalo_sy, thishalo_sz]

    # logger.info("=============In halo {} of {}, ID {}, mh = {}x10^12 \n ============".format(i+1,len(halocat_100_midmh),thishalo_id,round(float(thishalo_mh)/1e12,2)))

    # ######  ######  ######

    # # thishalo_id, thishalo_mh, thishalo_rh = randhalo['haloID'][i], randhalo['mh'][i], (randhalo['rh'][i])/1000
    
    # # thishalo_x, thishalo_y, thishalo_z = randhalo['halo_x'][i], randhalo['halo_y'][i], randhalo['halo_z'][i]
    
    # # logger.info("=============In halo {} of {}, ID {} \n ============".format(i+1,len(randhalo),thishalo_id))

    # # print("=============In halo {} of {}, ID {} \n ============".format(i+1,len(halocat_25),thishalo_id))

    # # print(thishalo_mh)

    if float(thishalo_mh) >= 1.0e14:
        rhMult = 5  #multiplier of Rh for box half width
        starpercent = 5 #export a fraction of all the stars

    if float(thishalo_mh) >= 1.0e13:
        rhMult = 5  #multiplier of Rh for box half width
        starpercent = 20 #export a fraction of all the stars

    elif 1.0e13 > float(thishalo_mh) >= 1.0e12:
        rhMult = 3  #multiplier of Rh for box half width
        starpercent = 100 #export a fraction of all the stars

    # # if float(thishalo_mh) < 1.0e12:
    # #     rhMult = 1  #multiplier of Rh for box half width

    # # elif float(thishalo_mh) > 1.0e13:
    # #     rhMult = 2  #multiplier of Rh for box half width

    # # else:
    # #     rhMult = 1.5  #multiplier of Rh for box half width

    boxWidth = thishalo_rh * rhMult

    leftx,lefty,leftz = thishalo_x-boxWidth,thishalo_y-boxWidth,thishalo_z-boxWidth
    rightx,righty,rightz = thishalo_x+boxWidth,thishalo_y+boxWidth,thishalo_z+boxWidth
        
    #enforce the boundaries of the full box:
    
    if leftx<0:
        leftx = 0
    if lefty<0:
        lefty = 0
    if leftz<0:
        leftz = 0
        
    if rightx>ds.domain_width.to('Mpc')[0]:
        rightx = ds.domain_width.to('Mpc')[0].to_value()
    if righty>ds.domain_width.to('Mpc')[0]:
        righty =  ds.domain_width.to('Mpc')[0].to_value()
    if rightz>ds.domain_width.to('Mpc')[0]:
        rightz = ds.domain_width.to('Mpc')[0].to_value()

    # left_edge = [thishalo_x-boxWidth,thishalo_y-boxWidth,thishalo_z-boxWidth]
    
    # right_edge = [thishalo_x+boxWidth,thishalo_y+boxWidth,thishalo_z+boxWidth]
    
    left_edge = [leftx,lefty,leftz]
    
    right_edge = [rightx,righty,rightz]

    # gridlist = extractFeatures(ds,EAGLE100,'EAGLE',resolution_list,field_list,starpercent,left_edge,right_edge,thishalo_id,)

    # stars = exportStars(EAGLE100,ds,starpercent,'EAGLE',left_edge,right_edge,thishalo_id)

    meta =  exportSimMetadata(EAGLE100,left_edge,right_edge,thishalo_id,thishalo_galcenter,thishalo_galspin)

    # logger.info("=============Stars created, box dims:{}--{} \n ============".format(left_edge,right_edge))
    # print("=============Zoom-in created, box dims:{}--{} \n ============".format(left_edge,right_edge))

# print('LOOP ENDED')   

logger.info("=============LOOP ENDED============")

endTime = time.time()
print(time.gmtime(endTime))

timeTakenS = endTime-startTime

timeTakenM = (endTime-startTime)//60

timeTakenH = timeTakenM//60

timeTakenS2 = timeTakenS - (timeTakenH*60*60) - (timeTakenM*60)

# time.gmtime(timeTaken)

logger.info('Time in seconds: {}'.format(timeTakenS))
# print('Total Time: {} hours {} mins {} sec'.format(timeTakenH,timeTakenM,timeTakenS2))


# sys.stdout = old_stdout
# log_file.close()

# ######### ######### ######### ######### ######### ######### ######### 
# ######### ######### ######### ######### ######### ######### 

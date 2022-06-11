#!/usr/bin/env python
# coding: utf-8
# FARHANUL HASAN (farhasan@nmsu.edu)

### CosmoVis Data Preprocessing - make PartType files for derived fields

# from IPython import get_ipython
# get_ipython().run_line_magic('matplotlib', 'inline')
import numpy as np
import yt
from yt import YTArray
import trident
import eagleSqlTools as sql
import yt.units as units
from yt.visualization.volume_rendering.api import PointSource
from yt.units import kpc
import pylab
import json
import math
from math import log10, floor
import sys,os
import time
from astropy.io import fits
from astropy.table import Table
from astropy.io import ascii
import logging
import random
# import os.path
# from os import path
import matplotlib.pyplot as plt
# yt.enable_parallelism()
import pdb
import h5py

from scipy.interpolate import interpn
from scipy.interpolate import griddata

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

startTime = time.time()

print(time.gmtime(startTime))

#NEW (GENERAL)

def extractFeatures(ds,simpath,sim_type,resolution_list,field_list,left_edge,right_edge,haloid=None,galcenter=None,galspin=None):
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
    glist = generateVoxelGrid(simpath,ds,resolution_list,field_list,sim_type,left_edge,right_edge,haloid=None)
   
    if haloid:

        logger.info("=====Voxelized grids generated for halo {} =====".format(haloid))  
    else:
        logger.info("=====Voxelized grids generated for sim {} =====".format(simpath))  

    # print('EXPORTING STARS')
    # exportStars(simpath,ds,percent_stars,sim_type,left_edge,right_edge,haloid)
    # # print('WRITING METADATA')
    # exportSimMetadata(simpath,left_edge,right_edge,haloid=None,galcenter=None,galspin=None)

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
    df = sorted(ds.derived_field_list)
    # print(sorted(df))
    return df


def generateVoxelGrid(simpath,ds,resolution_list,field_list,sim_type,left_edge,right_edge,haloid=None):
    # simpath
    # resolution_list: list of resolutions to create, ex: [64,128,512] or [512]
    # field_list: list of particle fields to preprocess, ex: [['PartType0','Temperature'],['PartType0','Density'],['PartType1','Density']]
    fieldgridlist = []
    for j in range(len(resolution_list)):
        fieldgrids = []
        for i in range(len(field_list)):
            size = resolution_list[j]
            obj = createGrid(ds,size,field_list[i][1],left_edge,right_edge)
            grid = preprocessAttribute(simpath,obj,size,field_list[i][0],field_list[i][1],sim_type,haloid=None)
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


def preprocessAttribute(simpath,obj,size,particle_type,attribute,sim_type,haloid=None):
#     print(size)
    elements = ['PartType1_count', 'PartType1_density', 'PartType1_mass','Hydrogen','Helium','Carbon','Nickel','Oxygen','Neon','Magnesium','Silicon','Iron']
    
    logger.info("=====Preprocessing attribute: {} -- {} =====".format(str(particle_type),str(attribute)))  

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
        elif str(f.units) == 'erg/s':
            attr = np.float32(np.array(f))
            units = 'erg/s'  
        elif str(f.units) == '(dimensionless)':
            attr = np.float32(np.array(f))
            units = 'dimensionless'
        else:
            attr = np.float32(np.array(f.in_cgs()))
            units = f.in_cgs().units
        if attribute == "Metallicity" or attribute == "GFM_Metallicity":
            attr = np.float32(np.array(f.in_units("Zsun")))
            units = 'Zsun'
        elif attribute == "Pressure":
            attr = np.float32(np.array(f.in_units("K/cm**3")))
            units = "K/cm**3"
#         print(attribute,units)

        if attribute in elements:
            out = compressVoxelData(attr.tolist(),size,particle_type,attribute)

        else:
            out = transformVoxelData(attr)
            out = compressVoxelData(out,size,particle_type,attribute)

        if haloid:
            with open( 'static/data/'+ str(simpath) + '/Halos/halo_' + str(haloid) + '/' + particle_type + '/' + str( size ) + '_' + particle_type + '_' + attribute + '.json', 'w' ) as file:
                json.dump( out, file, separators=(',', ':') ) 
        else:
            with open( 'static/data/'+ str(simpath) + '/' + particle_type + '/' + str( size ) + '_' + particle_type + '_' + attribute + '.json', 'w' ) as file:
                json.dump( out, file, separators=(',', ':') ) 

    except Exception as e:
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno)
        
    return attr   

def transformVoxelData(voxelized_data):
    logger.info("=====Transforming voxel data")  

    out = np.log10(voxelized_data.tolist())
    return out.tolist()

def compressVoxelData(voxelized_data,size,particle_type,attribute):
    
    logger.info("=====Compressing voxel data: {} -- {} =====".format(str(particle_type),str(attribute)))  

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
            # if attribute == 'Pressure':
            #     min_val = -4.0
            #     max_val = 7.0
            # if attribute == 'Mach_number':
            #     min_val = -4.0
            #     max_val = 5.0
            # if attribute == 'tcool_tff':
            #     min_val = -5.0
            #     max_val = 3.0               

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


# def exportStars(simpath,ds,percent,sim_type,left_edge,right_edge,haloid):
#     # percent: % of number of particles to export between (0,100)

#     ad=ds.r[ds.quan(left_edge[0], "Mpc"):ds.quan(right_edge[0],"Mpc"), ds.quan(left_edge[1], "Mpc"):ds.quan(right_edge[1],"Mpc"), ds.quan(left_edge[2], "Mpc"):ds.quan(right_edge[2],"Mpc")]   
    
#     index = np.random.randint(0,len(ad['PartType4', 'Coordinates']),size=int(len(ad['PartType4', 'Coordinates'])*(percent/100)))
#     star_particles = {}

#     for i in range(0,int(len(index)-1)):
#         j = index[i]
#         if sim_type == 'EAGLE':
#             star_particles[i] = (
#                                     round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
#                                     round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
#                                     round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
#                                     int(ad['PartType4', 'GroupNumber'][j]), # group ID
#                                     round(float(np.log10(ad['PartType4', 'Mass'][j].in_units('Msun'))),2) # stellar mass
#                                 )
#         if sim_type == 'TNG':
#             star_particles[i] = (
#                                     round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
#                                     round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
#                                     round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
#                                     int(ad['PartType4', 'ParticleIDs'][j]), # group ID
#                                     round(float(np.log10(ad['PartType4', 'Masses'][j].in_units('Msun'))),2) # stellar mass
#                                 )

#     with open('static/data/'+ str(simpath) + '/Halos/halo_' + str(haloid) + '/PartType4/star_particles.json', 'w') as file:
#         json.dump(star_particles, file, separators=(',', ':') )
#     # print("exported {} stars".format(len(index)))

#     logger.info("=====exported {} stars=====".format(len(index)))   
        

def exportSimMetadata(simpath,left_edge,right_edge,haloid=None,galcenter=None,galspin=None):

    logger.info("===== Exporting Metadata =====")  

    # ds = loadData(simpath)

    fl = getFieldList(ds)

    fields2 = []

    for i in fl:
        fields2.append([i[0],i[1]])

    if haloid:
        # fields2 = [["PartType0", "AExpMaximumTemperature"], ["PartType0", "Carbon"], ["PartType0", "Coordinates"], ["PartType0", "Density"], ["PartType0", "Entropy"], ["PartType0", "GroupNumber"], ["PartType0", "Helium"], ["PartType0", "HostHalo_TVir_Mass"], ["PartType0", "Hydrogen"], ["PartType0", "InternalEnergy"], ["PartType0", "Iron"], ["PartType0", "IronMassFracFromSNIa"], ["PartType0", "Magnesium"], ["PartType0", "Mass"], ["PartType0", "MaximumTemperature"], ["PartType0", "MetalMassFracFromAGB"], ["PartType0", "MetalMassFracFromSNII"], ["PartType0", "MetalMassFracFromSNIa"], ["PartType0", "Metallicity"], ["PartType0", "Neon"], ["PartType0", "Nitrogen"], ["PartType0", "OnEquationOfState"], ["PartType0", "Oxygen"], ["PartType0", "ParticleIDs"], ["PartType0", "Silicon"], ["PartType0", "SmoothedIronMassFracFromSNIa"], ["PartType0", "SmoothedMetallicity"], ["PartType0", "SmoothingLength"], ["PartType0", "StarFormationRate"], ["PartType0", "SubGroupNumber"], ["PartType0", "Temperature"], ["PartType0", "TotalMassFromAGB"], ["PartType0", "TotalMassFromSNII"], ["PartType0", "TotalMassFromSNIa"], ["PartType0", "Velocity"], ["PartType1", "Coordinates"], ["PartType1", "GroupNumber"], ["PartType1", "Mass"], ["PartType1", "ParticleIDs"], ["PartType1", "SubGroupNumber"], ["PartType1", "Velocity"], ["PartType4", "AExpMaximumTemperature"], ["PartType4", "BirthDensity"], ["PartType4", "Carbon"], ["PartType4", "Coordinates"], ["PartType4", "Feedback_EnergyFraction"], ["PartType4", "GroupNumber"], ["PartType4", "Helium"], ["PartType4", "HostHalo_TVir"], ["PartType4", "HostHalo_TVir_Mass"], ["PartType4", "Hydrogen"], ["PartType4", "InitialMass"], ["PartType4", "Iron"], ["PartType4", "IronMassFracFromSNIa"], ["PartType4", "Magnesium"], ["PartType4", "Mass"], ["PartType4", "MaximumTemperature"], ["PartType4", "MetalMassFracFromAGB"], ["PartType4", "MetalMassFracFromSNII"], ["PartType4", "MetalMassFracFromSNIa"], ["PartType4", "Metallicity"], ["PartType4", "Neon"], ["PartType4", "Nitrogen"], ["PartType4", "Oxygen"], ["PartType4", "ParticleIDs"], ["PartType4", "PreviousStellarEnrichment"], ["PartType4", "Silicon"], ["PartType4", "SmoothedIronMassFracFromSNIa"], ["PartType4", "SmoothedMetallicity"], ["PartType4", "SmoothingLength"], ["PartType4", "StellarEnrichmentCounter"], ["PartType4", "StellarFormationTime"], ["PartType4", "SubGroupNumber"], ["PartType4", "TotalMassFromAGB"], ["PartType4", "TotalMassFromSNII"], ["PartType4", "TotalMassFromSNIa"], ["PartType4", "Velocity"], ["PartType5", "BH_CumlAccrMass"], ["PartType5", "BH_CumlNumSeeds"], ["PartType5", "BH_Density"], ["PartType5", "BH_FormationTime"], ["PartType5", "BH_Mass"], ["PartType5", "BH_Mdot"], ["PartType5", "BH_MostMassiveProgenitorID"], ["PartType5", "BH_Pressure"], ["PartType5", "BH_SoundSpeed"], ["PartType5", "BH_SurroundingGasVel"], ["PartType5", "BH_TimeLastMerger"], ["PartType5", "Coordinates"], ["PartType5", "GroupNumber"], ["PartType5", "HostHalo_TVir_Mass"], ["PartType5", "Mass"], ["PartType5", "ParticleIDs"], ["PartType5", "SmoothingLength"], ["PartType5", "SubGroupNumber"], ["PartType5", "Velocity"], ["all", "Coordinates"], ["all", "GroupNumber"], ["all", "Mass"], ["all", "ParticleIDs"], ["all", "SubGroupNumber"], ["all", "Velocity"], ["nbody", "Coordinates"], ["nbody", "GroupNumber"], ["nbody", "Mass"], ["nbody", "ParticleIDs"], ["nbody", "SubGroupNumber"], ["nbody", "Velocity"]]
            
        #######   SPIN INFO   #######

        contents = {"left_edge": left_edge, "right_edge": right_edge, "star_center": galcenter, "star_spin": galspin, "field_list": fields2}
        
        with open('static/data/'+ str(simpath) + '/Halos/halo_' + str(haloid) + '/' +  '/simMetadata.json', 'w') as file:
            json.dump(contents,file)
    #         json.dump(field_list, file)

    else:
        # fields2 = [["PartType0", "AExpMaximumTemperature"], ["PartType0", "Carbon"], ["PartType0", "Coordinates"], ["PartType0", "Density"], ["PartType0", "Entropy"], ["PartType0", "GroupNumber"], ["PartType0", "Helium"], ["PartType0", "HostHalo_TVir_Mass"], ["PartType0", "Hydrogen"], ["PartType0", "InternalEnergy"], ["PartType0", "Iron"], ["PartType0", "IronMassFracFromSNIa"], ["PartType0", "Magnesium"], ["PartType0", "Mass"], ["PartType0", "MaximumTemperature"], ["PartType0", "MetalMassFracFromAGB"], ["PartType0", "MetalMassFracFromSNII"], ["PartType0", "MetalMassFracFromSNIa"], ["PartType0", "Metallicity"], ["PartType0", "Neon"], ["PartType0", "Nitrogen"], ["PartType0", "OnEquationOfState"], ["PartType0", "Oxygen"], ["PartType0", "ParticleIDs"], ["PartType0", "Silicon"], ["PartType0", "SmoothedIronMassFracFromSNIa"], ["PartType0", "SmoothedMetallicity"], ["PartType0", "SmoothingLength"], ["PartType0", "StarFormationRate"], ["PartType0", "SubGroupNumber"], ["PartType0", "Temperature"], ["PartType0", "TotalMassFromAGB"], ["PartType0", "TotalMassFromSNII"], ["PartType0", "TotalMassFromSNIa"], ["PartType0", "Velocity"], ["PartType0", "Pressure"], ["PartType0", "Mach_number"], ["PartType1", "Coordinates"], ["PartType1", "GroupNumber"], ["PartType1", "Mass"], ["PartType1", "ParticleIDs"], ["PartType1", "SubGroupNumber"], ["PartType1", "Velocity"], ["PartType4", "AExpMaximumTemperature"], ["PartType4", "BirthDensity"], ["PartType4", "Carbon"], ["PartType4", "Coordinates"], ["PartType4", "Feedback_EnergyFraction"], ["PartType4", "GroupNumber"], ["PartType4", "Helium"], ["PartType4", "HostHalo_TVir"], ["PartType4", "HostHalo_TVir_Mass"], ["PartType4", "Hydrogen"], ["PartType4", "InitialMass"], ["PartType4", "Iron"], ["PartType4", "IronMassFracFromSNIa"], ["PartType4", "Magnesium"], ["PartType4", "Mass"], ["PartType4", "MaximumTemperature"], ["PartType4", "MetalMassFracFromAGB"], ["PartType4", "MetalMassFracFromSNII"], ["PartType4", "MetalMassFracFromSNIa"], ["PartType4", "Metallicity"], ["PartType4", "Neon"], ["PartType4", "Nitrogen"], ["PartType4", "Oxygen"], ["PartType4", "ParticleIDs"], ["PartType4", "PreviousStellarEnrichment"], ["PartType4", "Silicon"], ["PartType4", "SmoothedIronMassFracFromSNIa"], ["PartType4", "SmoothedMetallicity"], ["PartType4", "SmoothingLength"], ["PartType4", "StellarEnrichmentCounter"], ["PartType4", "StellarFormationTime"], ["PartType4", "SubGroupNumber"], ["PartType4", "TotalMassFromAGB"], ["PartType4", "TotalMassFromSNII"], ["PartType4", "TotalMassFromSNIa"], ["PartType4", "Velocity"], ["PartType5", "BH_CumlAccrMass"], ["PartType5", "BH_CumlNumSeeds"], ["PartType5", "BH_Density"], ["PartType5", "BH_FormationTime"], ["PartType5", "BH_Mass"], ["PartType5", "BH_Mdot"], ["PartType5", "BH_MostMassiveProgenitorID"], ["PartType5", "BH_Pressure"], ["PartType5", "BH_SoundSpeed"], ["PartType5", "BH_SurroundingGasVel"], ["PartType5", "BH_TimeLastMerger"], ["PartType5", "Coordinates"], ["PartType5", "GroupNumber"], ["PartType5", "HostHalo_TVir_Mass"], ["PartType5", "Mass"], ["PartType5", "ParticleIDs"], ["PartType5", "SmoothingLength"], ["PartType5", "SubGroupNumber"], ["PartType5", "Velocity"], ["all", "Coordinates"], ["all", "GroupNumber"], ["all", "Mass"], ["all", "ParticleIDs"], ["all", "SubGroupNumber"], ["all", "Velocity"], ["nbody", "Coordinates"], ["nbody", "GroupNumber"], ["nbody", "Mass"], ["nbody", "ParticleIDs"], ["nbody", "SubGroupNumber"], ["nbody", "Velocity"]]

        left_edge = left_edge * ds.length_unit.in_units("Mpc")
        right_edge = right_edge * ds.length_unit.in_units("Mpc")

        left_edge = [float(left_edge[0]),float(left_edge[1]),float(left_edge[2])]
        right_edge = [float(right_edge[0]),float(right_edge[1]),float(right_edge[2])]

        contents = {"left_edge": left_edge, "right_edge": right_edge, "field_list": fields2}
        
        with open('static/data/'+ str(simpath) + '/' +  '/simMetadata2.json', 'w') as file:
            json.dump(contents,file)        


################## ################## ################## ################## 
################## ################## ##################

#import halo catalogs:

EAGLE12, EAGLE25, EAGLE100 = 'RefL0012N0188', 'RefL0025N0376', 'RefL0100N1504'

# halocat_12 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE12)+'.txt')
# halocat_25 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE25)+'.txt')
# halocat_100 = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'.txt')

# halocat_100_highmh = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'_m13'+'.txt')
# halocat_100_midmh = ascii.read('static/data/halo_cats/halos_'+str(EAGLE100)+'_m12'+'.txt')


# list of voxel grid resolutions to export (creates cubes based on specified edge length)
resolution_list = [64,128,256]

# field_list = [('PartType0','Temperature'),('PartType0','Density'),('PartType0','Entropy'),('PartType0','Metallicity'),('PartType0', 'H_number_density')]


###### definitions of derived fields ###### 
######  ######  ######  ######  ###### 

def _pressure(field, data):
    "P/K"
    # kb = units.physical_constants.boltzmann_constant_cgs
    amu = units.physical_constants.amu_cgs
#     return (data["PartType0", "density"] * kb * data["PartType0", "Temperature"])/data["PartType0", "mass"]
    return (data["PartType0", "density"] * data["PartType0", "Temperature"])/(.61 * amu)

def _mach_number(field, data):
    """M{|v|/c_sound}"""
    kb = units.physical_constants.boltzmann_constant_cgs
    amu = units.physical_constants.amu_cgs
    cs = np.sqrt((kb * data["PartType0", "Temperature"])/ (0.61*amu))   #speed of sound
    return data["PartType0", "velocity_magnitude"] / cs


###Cooling functions:

#import cooling tables:

red_bins, met_bins, temp_bins, dens_bins = [],[],[],[]

iden_bins = np.arange(0,22,1)

table_bins = [[],[],[],[],[]]

cooling_fns = []

with h5py.File('cooling_tables/UVB_dust1_CR0_G0_shield0.hdf5', "r") as f:
    # List all groups
    # print("Keys: %s" % f.keys())
    a_group_key = list(f.keys())[4]
    
    d2 = f['IdentifierCooling'][()]
    d3 = f['TableBins']
    d4 = f['Tdep']
    
    for i in f['TableBins']:
        
        bins = f['TableBins/'+str(i)][()]

        # print(len(bins),len(f['TableBins/MetallicityBins'][()]),len(f['TableBins/RedshiftBins'][()]),len(f['TableBins/TemperatureBins'][()]),len(f['TableBins/InternalEnergyBins'][()]))
        
        if "Redshift" in i:
            red_bins.append(bins)
            
        elif "Temperature" in i:
            temp_bins.append(bins)
            
        elif "Density" in i:
            dens_bins.append(bins)      

        elif "Metallicity" in i:
            met_bins.append(bins)
            
        
    for i in range(len(f['Tdep/Cooling'])):
        
        cooling_fns.append(f['Tdep/Cooling'][i])

cooling_fns = np.asarray(cooling_fns)

#interpolation gridpoints:

gridPoints = (red_bins[0], temp_bins[0], met_bins[0], dens_bins[0], iden_bins)

#cooling time function:

def _cooling_fn(data):
    ''' cooling function from Ploeckinger+Schaye(2020) tables '''
    kb = units.physical_constants.boltzmann_constant_cgs
    z,T,met,dens = 0, data["PartType0", "Temperature"].to('K'), data["PartType0", "metallicity"].to('Zsun'), data["PartType0", "H_number_density"].to('cm**-3')
    
    #for out-of-bound values:
    
#     ptH_def, ptZ_def = (red_bins[0][0], temp_bins[0][0], met_bins[0][0], dens_bins[0][0],20), (red_bins[0][0], temp_bins[0][0], met_bins[0][0], dens_bins[0][0],21)
    ptH_def, ptZ_def = (red_bins[0][0], temp_bins[0][-1], met_bins[0][-1], dens_bins[0][-1],20), (red_bins[0][0], temp_bins[0][-1], met_bins[0][-1], dens_bins[0][-1],21)

#     int0 = interpn(gridPoints,cooling_fns,specificPoint0)[0]

    coolH_def, coolZ_def = interpn(gridPoints,cooling_fns,ptH_def)[0], interpn(gridPoints,cooling_fns,ptZ_def)[0]

    ptH, ptZ = (z,T,met,dens,20), (z,T,met,dens,21)
    
    coolH, coolZ = interpn(gridPoints,cooling_fns,ptH,bounds_error=False,fill_value=coolH_def), interpn(gridPoints,cooling_fns,ptZ,bounds_error=False,fill_value=coolZ_def)
    
    unlog_tot = (10**coolH) + (10**coolZ)
    
    
#     log_tot = np.log10(unlog_tot)

    final = unlog_tot * ((ds.units.erg * (ds.units.cm)**3) / ds.units.s)
    
    return final


def _cooling_time(field, data):
    ''' cooling time '''
    kb = units.physical_constants.boltzmann_constant_cgs
    
    # num = (3/2) * kb * data["PartType0", "Temperature"]
    num = (3/2) * (2.3) * kb * data["PartType0", "Temperature"]  #2.3 H atoms per particle, as in Stern+21

    den = _cooling_fn(data) * data["PartType0", "H_number_density"]
    
    return num/den


#free-fall time function:

def _freefall_time(field, data):
    ''' free-fall time '''
    G = units.physical_constants.gravitational_constant_cgs
    
    y = np.sqrt(3/(2*np.pi*G*data["PartType0", "density"].in_cgs()))
    
    return y


#cooling over free-fall time function:

def _tcool_tff(field, data):
    ''' cooling/free-fall time '''
#     G = yt.units.physical_constants.gravitational_constant_cgs
    
#     ad = data.all_data()
#     y = np.sqrt(3/(2*np.pi*G*data["PartType0", "density"]))
    
    return data["PartType0", "Cooling_time"]/data["PartType0", "Freefall_time"]
                                        

######  ######  ######  ######  ###### 

#######  Make PartType files for the sims ###### 
######  ######  ######  ######  ###### 

# for i in [EAGLE100,EAGLE25,EAGLE12]:
for i in [EAGLE100,EAGLE25,EAGLE12]:

    logger.info("============= LOADING IN DATA: {} ============".format(str(i)))

    ds = loadData(i)
    # print('EXTRACTING FIELD LIST')

    logger.info("============= DATA LOADED: {} ============".format(str(i)))

    ##### ##### ##### Add derived fields ##### ##### ##### 

    # Add soft X-ray fields:

    yt.add_xray_emissivity_field(ds, 0.1, 2,ftype="PartType0")

    # Add pressure to dataset
    # ds.add_field(
    #     ("PartType0", "Pressure"),
    #     units="K/cm**3",
    #     function=_pressure,particle_type="PartType0",
    #     sampling_type="local"
    #     # ,force_override=True
    # )

    # # Add Mach number to dataset
    # ds.add_field(
    #     ("PartType0", "mach_number"),
    #     function=_mach_number,particle_type="PartType0",
    #     sampling_type="local"
    ## ,force_override=True
    # )

    # # Add tcool to dataset:
    # ds.add_field(("PartType0", "Cooling_time"),function=_cooling_time,particle_type="PartType0",
    # sampling_type="local",
    # # units="auto",dimensions=yt.units.dimensions.power * yt.units.dimensions.volume,
    # # units="(erg*cm**3)/s",
    # units='gigayear'
    # # ,
    # # force_override=True
    # #     units="",   
    # )

    # # Add tff to dataset:
    # ds.add_field(("PartType0", "Freefall_time"),function=_freefall_time,particle_type="PartType0",
    # sampling_type="local",
    # units='gigayear'
    # # ,
    # # force_override=True
    # )

    # ad = ds.all_data()

    # # Add tcool/tff to dataset:
    # ds.add_field(("PartType0", "tcool_tff"),function=_tcool_tff,particle_type="PartType0",
    # sampling_type="local"
    # # ,
    # # force_override=True
    # )

    ad = ds.all_data()

    logger.info("============= ADDED DERIVED FIELDS for {} ============".format(str(i)))

    fl = getFieldList(ds)

    logger.info(fl)

    # field_list = [("PartType0", "tcool_tff")]
    # ,("PartType0", "Mach_number")
    # field_list = [("PartType0", "Pressure")]
    field_list = [("PartType0", "xray_luminosity_0.1_2_keV")]

    ######### ######### MAKE PARTTYPE FILES OF THESE DERIVED FIELDS ######### ######### 
    ######### ######### ######### ######### ######### ######### ######### 

    logger.info("============= STARTING PREPROCESSING for {} ============".format(str(i)))

    left_edge,right_edge = ds.domain_left_edge, ds.domain_right_edge

    extractFeatures(ds,i,'EAGLE',resolution_list,field_list,left_edge,right_edge)

    # exportSimMetadata(i,left_edge,right_edge)

    logger.info("============= PREPROCESSING DONE for {}============".format(str(i)))

######  ######  ######  ######  ###### 
######  ######  ######  ######  ###### 

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

# preprocess.py
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

def extractFeatures(simpath,resolution_list,field_list,percent_stars):
    enableParallelism()
    verifyTrident()
    print('LOADING DATA')
    ds = loadData(simpath)
    print('EXTRACTING FIELD LIST')
    fl = getFieldList(ds)
    print('GENERATING VOXEL GRIDS')
    generateVoxelGrid(ds,resolution_list,field_list)
    print('EXPORTING STARS')
    exportStars(ds,percent_stars)


def enableParallelism():
    #Note: Requires MPI to be installed on machine
    yt.enable_parallelism()

def verifyTrident():
    trident.verify()

def loadData(filename):
    fn = filename
    print(fn)
    ds = yt.load(fn)
    return ds

def getFieldList(ds):
    fl = sorted(ds.field_list)
    print(fl)
    df = ds.derived_field_list
    print(df)
    return fl

def createGrid(ds,size):
    print("create grid")
    obj = ds.arbitrary_grid(ds.domain_left_edge, ds.domain_right_edge,
                        dims=[size, size, size])
    return obj

def preprocessAttribute(obj,size,particle_type,attribute):
    try:
        print('EXTRACTING: ' + particle_type + ', ' + attribute)
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
        print(attribute,units)
        with open(str(size)+'_'+particle_type+'_'+attribute+'.json', 'w') as file:
            json.dump(attr.tolist(), file)   
    except Exception as e:
        print('error: '+ str(e))
        
    def preprocessAttributes(ds,size,particle_type):
        for i in range(len(fl)):
            obj = createGrid(ds,size)
            if fl[i][0] == particle_type:
                attribute = fl[i][1]
                preprocessAttribute(obj,size,particle_type,attribute)

def generateVoxelGrid(ds,resolution_list,field_list):
    # simpath
    # resolution_list: list of resolutions to create, ex: [64,128,512] or [512]
    # field_list: list of particle fields to preprocess, ex: [['PartType0','Temperature'],['PartType0','Density'],['PartType1','Density']]
    for j in range(len(resolution_list)):
        for i in range(len(field_list)):
            size = resolution_list[j]
            obj = createGrid(ds,size)
            preprocessAttribute(obj,size,field_list[i][0],field_list[i][1])

def exportStars(ds,percent):
    # percent: % of number of particles to export between (0,100)
    ad=ds.all_data()
    index = np.random.randint(0,len(ad['PartType4', 'Coordinates']),size=int(len(ad['PartType4', 'Coordinates'])*(percent/100)))
    star_particles = {}
#     np.random.default_rng(4)
    for i in range(0,int(len(index)-1)):
        j = index[i]
        star_particles[i] = {
    #         'particleID' : int(ad['PartType4', 'ParticleIDs'][i]),
            'x' : float(ad['PartType4', 'Coordinates'][j][0]),
            'y' : float(ad['PartType4', 'Coordinates'][j][1]),
            'z' : float(ad['PartType4', 'Coordinates'][j][2]),
            # 'sft': float((ad['PartType4', 'GFM_StellarFormationTime'][j])) #unitless
        }
#             # more star attributes can be defined
#     #         'mass' : round(float(np.log10(ad['PartType4', 'Mass'][i].in_units('Msun'))),2)
    with open(str(percent)+'_star_particles.json', 'w') as file:
        json.dump(star_particles, file)
    print("exported stars")
    
def exportSimMetadata(ds,field_list):
    with open('simMetadata.json', 'w') as file:
        json.dump(field_list, file)

# def makeSimpleRay(ds,startPos,endPos):
#     ray = trident.make_simple_ray(ds, start_position=startPos,
#                                end_position=endPos,
#                                data_filename="ray.h5",
#                                fields=[('gas', 'density'), ('gas', 'temperature'), ('gas', 'metallicity')])
#     return ray

# def generateSkewer(ds,startPos,endPos):
#     ray = makeSimpleRay(ds,startPos,endPos)
#     line_list = ['H', 'C', 'N', 'O', 'Mg']
#     sg = trident.SpectrumGenerator('COS-G130M')
#     sg.make_spectrum(ray, lines=line_list)
#     sg.add_qso_spectrum(emitting_redshift=0.5)
#     sg.add_milky_way_foreground()
#     sg.apply_lsf() #instumental profile
#     sg.add_gaussian_noise(30)
#     sg.plot_spectrum('spec_qso_corrected.png')
#     sg.save_spectrum('spec_qso_corrected.txt')
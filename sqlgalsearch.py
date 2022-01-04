import eagleSqlTools as sql 
import numpy as np
import json


def return_sql_query(sims,connect):
    " mySims should be an array with each entry like (simName,simSize)"

    for name,size in mySims:
        print(name,size)

        # Construct and execute query:
        myQuery = "SELECT \
            SH.GalaxyID as galID, \
            SH.GroupID as haloID, \
            SH.GroupNumber as groupNum, \
            SH.SubGroupNumber as subgroupNum,  \
            FOF.Group_M_Crit200 as mh,   \
            FOF.Group_R_Crit200 as rh,  \
            FOF.NumOfSubhalos as num_sh,  \
            SH.MassType_Star as ms,  \
            SH.MassType_Gas as mg,  \
            SH.StarFormationRate as sfr,  \
            SH.CentreOfPotential_x as gal_x,  \
            SH.CentreOfPotential_y as gal_y,  \
            SH.CentreOfPotential_z as gal_z,  \
            FOF.GroupCentreOfPotential_x as halo_x,  \
            FOF.GroupCentreOfPotential_y as halo_y,  \
            FOF.GroupCentreOfPotential_z as halo_z  \
        FROM \
            %s_SubHalo as SH, \
            %s_FOF as FOF  \
        WHERE  \
            SH.Snapnum = 28 and   \
            SH.MassType_Star > 1.0e8 and  \
            Spurious = 0 and  \
            FOF.GroupID = SH.GroupID and   \
            FOF.SnapNum = SH.Snapnum"%(name, name)

        query_out = sql.execute_query(con, myQuery)
        
        ex = np.transpose(query_out)
        
        #Write json files:
        jsonfile = open('galaxies_'+str(name)+'.json', 'w')
        jsonfile.write('[')

        for row in ex:
            entr = {'galID':row[0].tolist(),'haloID':row[1].tolist(),'groupNum':row[2].tolist(),'subgroupNum':row[3].tolist(),'mh':row[4].tolist(),'rh':row[5].tolist(),'num_sh':row[6].tolist(),'ms':row[7].tolist(),'mg':row[8].tolist(),'sfr':row[9].tolist(),'gal_x':row[10].tolist(),'gal_y':row[11].tolist(),'gal_z':row[12].tolist(),'halo_x':row[13].tolist(),'halo_y':row[14].tolist(),'halo_z':row[15].tolist()}
            json.dump(entr, jsonfile, separators=(',', ':'))
            if row == ex[-1]:
                jsonfile.write(']')

            else:
                jsonfile.write(',\n')

        # jsonfile.write(']')

# Array of chosen simulations. Entries refer to the simulation name and comoving box length.
mySims = np.array([('RefL0100N1504', 100.), ('RefL0025N0376', 25.), ('RefL0012N0188', 12.5)])

# This uses the eagleSqlTools module to connect to the database with your username and password. # If the password is not given, the module will prompt for it.
con = sql.connect("psf414", password="LSM83gls") #FH id and password

return_sql_query(mySims,con)
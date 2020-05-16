/**
 * ! CosmoVis - Volumetric Rendering version
 */


/**
 * * Instantiate global variables
 */

var container //floating GUI containers
var camera, scene, renderer, material, skewerScene //THREE.js environment variables
var tex1 = new THREE.TextureLoader().load( "static/textures/blur.png" );
const windowHalf = new THREE.Vector2( window.innerWidth / 2, window.innerHeight / 2 );
var field_list //contains list of particle fields
var gasMinCol, gasMaxCol, dmMinCol, dmMaxCol, starMinCol, starMaxCol, bhMinCol, bhMaxCol //stores colors for different particle types
var gm, gmx, bhm, bhmx //used for changeValue()
var brusher //used for spectra brush
var gui //used to hold dat.GUI object
var material
var cmtexture
var uniforms

var elements = ['Hydrogen','Helium','Carbon','Nickel','Oxygen','Neon','Magnesium','Silicon','Iron']
// var volconfig

/**
 * * these variables are used for raycasting when drawing skewers
 */
var cube
const mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var plane = new THREE.Plane();
var planeNormal = new THREE.Vector3();
var point = new THREE.Vector3();
var edges
var skewers = []
var drawSkewers = false
var line
var lines = []
var container_hover //used to determine if the mouse is over a GUI container when drawing skewers
var edges_scaled = []

/**
 * * used with refreshLoop() to get fps
 */
const times = [];
let fps;

/**
 * * GLOBAL FUNCTIONS 
 */

function clearThree(obj){
    /**
     * * removes THREE.js objects and materials from memory more efficiently than just by setting `scene = []`
     */
    while(obj.children.length > 0){ 
      clearThree(obj.children[0])
      obj.remove(obj.children[0]);
    }
    if(obj.geometry) obj.geometry.dispose()
  
    if(obj.material){ 
      //in case of map, bumpMap, normalMap, envMap ...
      Object.keys(obj.material).forEach(prop => {
        if(!obj.material[prop])
          return         
        if(typeof obj.material[prop].dispose === 'function')                                  
          obj.material[prop].dispose()                                                        
      })
      obj.material.dispose()
    }
}

/**
 * TODO: connect gui uniforms to custom UI
 */
function updateUniforms() {
    // console.log('update uniforms')
    material.uniforms[ "u_clim" ].value.set( document.querySelector('#gas-minval-input').value, document.querySelector('#gas-maxval-input').value );
    material.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
    material.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
    // material.uniforms[ "u_cmdata" ].value = cmtextures[ volconfig.colormap ];

    gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
    gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
    
    w = 256
    h = 1
    size = w * h
    data = new Uint8Array(3 * size)
    for(i=0;i<w;i++){
        stride = i * 3
        a = i/w
        c = gasMinCol.clone().lerp(gasMaxCol,a)
        // console.log(c)
        // console.log(c.r,c.g,c.b)
        data[stride] = Math.floor(c.r*255)
        data[stride+1] = Math.floor(c.g*255)
        data[stride+2] = Math.floor(c.b*255)
    }

    cmtexture = new THREE.DataTexture(data,w,h,THREE.RGBFormat)
    
    material.uniforms[ "u_cmdata" ].value = cmtexture;
}

// function loadDensity(size,type,attr){
//     d3.json('static/data/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(d){
          
//     })
// }

function loadAttribute(size,type,attr){
    /**
     * * loadAttribute() is called when selecting an attribute from one of the dropdown menus
     * 
     * size: number of voxels along each edge
     * type: particle type
     * attr: particle attribute
     * 
     * TODO: add error message if an invalid type is selected (velocity, group number, etc)
     * TODO: remove dat.GUI reliance, use custom container UI instead
     * TODO: scale volume rendering to match domain_left_edge and domain_right_edge
     */
    
     //load the desired dataset
    d3.json('static/data/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(d){
        clearThree(scene) //clears the THREE.js scene to prevent memory overload
        // if(gui){ //reset the dat.GUI
        //     gui.destroy()
        // }
        
        //set camera position so the entire dataset is in view
        camera.position.set(size, size, size)
        camera.lookAt(size/2,  size/2,  size/2)
        camera.zoom = 6
        camera.updateProjectionMatrix()
        controls.target.set( size/2,  size/2,  size/2 );

        //arr holds the flattened data in Float32Array to be used as a 3D texture
        arr = new Float32Array(size * size * size)

        let log
        if(elements.includes(attr)){
            log = false
        }
        else{
            log = true
        }    
        
        // log = false
        //fill arr array with loaded data
        for(x=0;x<size;x++){
            for(y=0;y<size;y++){
                for(z=0;z<size;z++){
                    if(log){
                        arr[ x + y * size + z * size * size ] =  Math.log10(d[x][y][z])
                    }
                    else{
                        arr[ x + y * size + z * size * size ] =  d[x][y][z]
                    }
                }
            }
        }
        // console.log(arr)
        d = [] //clear loaded data since it is no longer needed
        
        
        //find the min and max values in the dataset and set the values in the container GUI input boxes
        var max = arr.reduce(function(a, b) {
            return Math.max(a, b);
        });
        var min = arr.reduce(function(a, b) {
            return Math.min(a, b);
        });
        setMinMaxInputValues(type,min,max)

        function setMinMaxInputValues(type,min,max){
            if(type=="PartType0") type = 'gas'
            else if(type =="PartType5") type = 'bh'
            type = 'gas'
            let minval = document.getElementById(type+'-minval-input')
            minval.value = min
            let maxval = document.getElementById(type+'-maxval-input')
            maxval.value = max
        }
    
        

        // The gui for interaction
        // gui = new dat.GUI()
        volconfig = { clim1: min, clim2: max, renderstyle: 'mip', isothreshold: max, colormap: 'viridis' };
        // gui.add( volconfig, 'clim1', min, max, 0.00001 ).onChange( updateUniforms );
        // gui.add( volconfig, 'clim2', min, max, 0.00001 ).onChange( updateUniforms );


        gm = document.querySelector('#gas-minval-input')
        gm.addEventListener('input', updateUniforms);
        gmx = document.querySelector('#gas-maxval-input')
        gmx.addEventListener('input', updateUniforms);


        // gui.add( volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms );
        // gui.add( volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms );
        // gui.add( volconfig, 'isothreshold', min, max, 0.01 ).onChange( updateUniforms );
        
        //create texure from the data arr and select volume shader
        var texture = new THREE.DataTexture3D( arr, size, size, size)
        texture.format = THREE.RedFormat
        texture.type = THREE.FloatType
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.unpackAlignment = 1
        var shader = THREE.VolumeRenderShader1;
        var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

        arr = []

        // cmtextures = {
        //     gray: new THREE.TextureLoader().load( 'static/textures/cm_gray.png', render ),
        //     viridis: new THREE.TextureLoader().load( 'static/textures/cm_viridis.png', render )
        // };
        changeColor()
    
        // Material
        uniforms[ "u_data" ].value = texture;
        uniforms[ "u_size" ].value.set( size, size, size );
        uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
        uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        uniforms[ "u_cmdata" ].value = cmtexture;

        material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            clipping: false,
            side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
            transparent: true,
        } );

        // THREE.Mesh
        var geometry = new THREE.BoxGeometry( size, size, size );
        geometry.translate( size / 2, size / 2, size / 2 );

        createSkewerCube(size)

        var mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );

        // changeValue()

        // render();
    });
}

function changeColor(){
    /**
     * * changeColor() is called whe the value in a color selection box is changed and updates corresponding material uniforms
     * TODO: Create DataTexture from color scale
     */
    
    gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
    gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
    
    w = 256
    h = 1
    size = w * h
    data = new Uint8Array(3 * size)
    for(i=0;i<w;i++){
        stride = i * 3
        a = i/w
        c = gasMinCol.clone().lerp(gasMaxCol,a)
        // console.log(c)
        // console.log(c.r,c.g,c.b)
        data[stride] = Math.floor(c.r*255)
        data[stride+1] = Math.floor(c.g*255)
        data[stride+2] = Math.floor(c.b*255)
    }

    cmtexture = new THREE.DataTexture(data,w,h,THREE.RGBFormat)
    if(material){
        updateUniforms()
    }



    dmCol = new THREE.Color(document.querySelector("#dmCol").value);
    // dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
    starCol = new THREE.Color(document.querySelector("#starCol").value);
    // starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);
    bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
    bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

    col = document.getElementById('gas-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + gasMinCol.getHexString() +', #' + gasMaxCol.getHexString() + ')'
    col = document.getElementById('bh-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + bhMinCol.getHexString() +', #' + bhMaxCol.getHexString() + ')'
    
    document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
    document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value
    document.querySelector("#dmCol").style.backgroundColor = document.querySelector("#dmCol").value
    document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value
    document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value
    document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value


    materialGas.uniforms.minCol.value = new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0);
    materialGas.uniforms.maxCol.value = new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0);
    materialDarkMatter.uniforms.Col.value = new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0);
    // materialDarkMatter.uniforms.maxCol.value = new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0);
    
    materialStar.uniforms.Col.value = new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0);
    // materialStar.uniforms.maxCol.value = new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0);
    materialBlackHole.uniforms.minCol.value = new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0);
    materialBlackHole.uniforms.maxCol.value = new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0);

    localStorage.setItem('gasMinCol', "#" + gasMinCol.getHexString());
    localStorage.setItem('gasMaxCol', "#" + gasMaxCol.getHexString());
    
    localStorage.setItem('dmCol', "#" + dmCol.getHexString());
    // localStorage.setItem('dmMaxCol', "#" + dmMaxCol.getHexString());
    
    localStorage.setItem('starCol', "#" + starCol.getHexString());
    // localStorage.setItem('starMaxCol', "#" + starMaxCol.getHexString());

    localStorage.setItem('bhMinCol', "#" + bhMinCol.getHexString());
    localStorage.setItem('bhMaxCol', "#" + bhMaxCol.getHexString());
}

function createSkewerCube(size){
    /**
     * * createSkewerCube() creates an invisible cube that is scaled to the extents of the domain of the data
     * * this is used for using a raycaster when placing skewers
     * size = voxels per edge
     */
    
    var geometry = new THREE.BoxBufferGeometry( size,size,size );
    var material = new THREE.MeshBasicMaterial( {color: 0xffffff, wireframe: true, transparent: true, opacity: 0.0} );
    cube = new THREE.Mesh( geometry, material );
    cube.position.set(size/2, size/2, size/2);
    scene.add( cube );

    edges_scaled = {
        'left_edge' : [edges.left_edge[0],edges.left_edge[1],edges.left_edge[2]],
        'right_edge' : [size,size,size]
    }
}

function loadData(){
    
    // Load Volume Rendering Data
    d3.json('static/data/temp.json').then(function(d){
        
        size = 128
        arr = new Float32Array(size * size * size)
        
        for(x=0;x<size;x++){
            for(y=0;y<size;y++){
                for(z=0;z<size;z++){
                    arr[ x + y * size + z * size * size ] = d[x][y][z]
                }
            }
        }

        var max = arr.reduce(function(a, b) {
            return Math.max(a, b);
        });

        // console.log(max)
        
        // console.log(arr)
        function updateUniforms() {

			material.uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
			material.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
			material.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
            material.uniforms[ "u_cmdata" ].value = cmtexture;

			// render();

		}
        gui = new dat.GUI()

        // The gui for interaction
        volconfig = { clim1: 0, clim2: 300000, renderstyle: 'mip', isothreshold: 700, colormap: 'viridis' };
        gui.add( volconfig, 'clim1', 0, 300000, 0.00001 ).onChange( updateUniforms );
        gui.add( volconfig, 'clim2', 0, 300000, 0.00001 ).onChange( updateUniforms );
        gui.add( volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms );
        gui.add( volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms );
        gui.add( volconfig, 'isothreshold', 0, 30000, 0.01 ).onChange( updateUniforms );
        
        var texture = new THREE.DataTexture3D( arr, size, size, size)
        texture.format = THREE.RedFormat
        texture.type = THREE.FloatType
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.unpackAlignment = 1
        var shader = THREE.VolumeRenderShader1;
        var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

        arr = []


        cmtextures = {
            gray: new THREE.TextureLoader().load( 'static/textures/cm_gray.png', render ),
            viridis: new THREE.TextureLoader().load( 'static/textures/cm_viridis.png', render )

        };

    
        // Material

        uniforms[ "u_data" ].value = texture;
        uniforms[ "u_size" ].value.set( size, size, size );
        uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
        uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        uniforms[ "u_cmdata" ].value = cmtextures[ volconfig.colormap ];
        
        // uniforms[ "u_clim" ].value.set( 0 , 1000 );
        // uniforms[ "u_renderstyle" ].value = 0; // 0: MIP, 1: ISO
        // uniforms[ "u_renderthreshold" ].value = 900; // For ISO renderstyle
        // uniforms[ "u_cmdata" ].value = cmtextures.viridis;

        material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            clipping: false,
            side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
            transparent: true,
        } );

        // THREE.Mesh
        var geometry = new THREE.BoxGeometry( size, size, size );
        
        camera.position.set(size, size, size)
        camera.lookAt(size/2,  size/2,  size/2)
        camera.updateProjectionMatrix()
        controls.target.set( size/2,  size/2,  size/2 );
        geometry.translate( size / 2, size / 2, size / 2 );
        

        var mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );

        updateUniforms

        // render();

    })
    
}

function animate() {
    /**
     * * animate()
     */
        
    requestAnimationFrame( animate )      
}

function render() {
    /**
     * * render()
     */

    requestAnimationFrame( render );
    controls.update()
    renderer.render( scene, camera );

};

function round(value, decimals) {
    /**
     * * round() to a certain number of decimals 
     */
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}


function refreshLoop() {
    /*
     * * refreshLoop() finds the frame rate 
     */
    window.requestAnimationFrame(() => {
        const now = performance.now();
        while (times.length > 0 && times[0] <= now - 1000) {
        times.shift();
        }
        times.push(now);
        fps = times.length;
        refreshLoop();
    });
}

function toggleDrawSkewerMode(){
    /*
     * * toggleDrawSkewerMode() turns the visibility of placed skewers on and off 
     */
    drawSkewers = !drawSkewers
    if(drawSkewers){
        document.getElementById('skewer-laser').style.filter = 'invert(98%) sepia(0%) saturate(51%) hue-rotate(144deg) brightness(117%) contrast(100%)'
    }
    else{
        document.getElementById('skewer-laser').style.filter = ''
    }
}

function toggleValueThreshold(type,e){
    /*
     * * toggleValueThreshold() enforces the 'min' or 'max' checkbox state for controlling the color scale value
     * example: unchecked (default) users can change the value in the number input below. when checked, returns the value to the min or max
     type = particle type. 'gas' or 'bh'
     e = 'min' or 'max' checkbox

     TODO: Hook this up to the volume rendering
     */

    if(type == 'gas' && e == 'min'){
        document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
        if(document.getElementById("gas-min-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType0'
            attr = document.getElementById('gas_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialGas.uniforms.min.value = document.getElementById('gas-minval-input').value
        }
    }
    if(type == 'gas' && e == 'max'){
        document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);
        // materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        if(document.getElementById("gas-max-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType0'
            attr = document.getElementById('gas_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        }
    }
    if(type == 'bh' && e == 'min'){
        document.getElementById("bh-minval-input").disabled = (document.getElementById("bh-min-check").checked);
        // materialGas.uniforms.min.value = document.getElementById('gas-minval-input').value
        if(document.getElementById("bh-min-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType5'
            attr = document.getElementById('bh_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialBlackHole.uniforms.min.value = document.getElementById('bh-minval-input').value
        }
    }
    if(type == 'bh' && e == 'max'){
        document.getElementById("bh-maxval-input").disabled = (document.getElementById("bh-max-check").checked);
        // materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        if(document.getElementById("bh-max-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType5'
            attr = document.getElementById('bh_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialBlackHole.uniforms.max.value = document.getElementById('bh-maxval-input').value
        }
    }

    function findMinMax(type,attr,e){
        let min, max
        for( i=0; i<particles.length; i++ ){
            if(particles[i].particle_type == type && particles[i].attribute == attr){
                min = particles[i].min
                max = particles[i].max
            }
        }
        if( type == 'PartType0' ){
            if ( e == 'min' ){
                materialGas.uniforms.min.value = min
            }
            if ( e == 'max'){
                materialGas.uniforms.max.value = max
            }
        }
        if( type == 'PartType5' ){
            if ( e == 'min' ){
                materialBlackHole.uniforms.min.value = min
            }
            if ( e == 'max' ){
                materialBlackHole.uniforms.max.value = max
            }
        }
    }   
}

function clipPoints(type, e){
    /*
     * * clipPoints() hides particles above and below the value thresholds 
     !? can this work with the volume renderer? does it make sense?
     */

    minClip = document.getElementById(type + "-min-clip-check").checked
    maxClip = document.getElementById(type + "-max-clip-check").checked
    if( type == 'gas' ){
        if ( e == 'min' ){
            materialGas.uniforms.minClip.value = minClip
        }
        if ( e == 'max'){
            materialGas.uniforms.maxClip.value = maxClip
        }
    }
    if( type == 'bh' ){
        if ( e == 'min' ){
            materialBlackHole.uniforms.minClip.value = minClip
        }
        if ( e == 'max' ){
            materialBlackHole.uniforms.maxClip.value = maxClip
        }
    }
}

// function changeValue(){
//     /**
//     * * changeValue() is called when a user updates a number input value
//     * 
//     * TODO: fix this for volume renderer
//     */

//     // create event listeners
//     gm = document.querySelector('#gas-minval-input')
//     gm.addEventListener('input', updateUniforms());
    
//     gmx = document.querySelector('#gas-maxval-input')
//     gmx.addEventListener('input', updateUniforms());

//     bhm = document.querySelector('#bh-minval-input')
//     bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
    
//     bhmx = document.querySelector('#bh-maxval-input')
//     bhmx.addEventListener('input',changeVal('bh','max', document.getElementById('bh-maxval-input').value),true);
    
//     function changeVal(type,e,val){
//         console.log('change val')
//         if(type == 'gas' && e == 'min'){
//             materialGas.uniforms.min.value = val
//         }
//         if(type == 'gas' && e == 'max'){
//             materialGas.uniforms.max.value = val
//         } 
//         if(type == 'bh' && e == 'min'){
//             materialBlackHole.uniforms.min.value = val
//         }
//         if(type == 'bh' && e == 'max'){
//             materialBlackHole.uniforms.max.value = val
//         }            
//     }
// }

function updateUnits(type,units){
    /**
     * * updateUnits() Updates the units displayed underneath the number input box
     * TODO: get the units for the volume renderer
     */
    if (type == 'PartType0'){
        gas_units = document.getElementsByClassName('gas-attr-units')
        for(i=0;i<gas_units.length;i++){
            gas_units[i].textContent = units
        }
    }
    if (type == 'PartType5'){
        bh_units = document.getElementsByClassName('bh-attr-units')
        for(i=0;i<bh_units.length;i++){
            bh_units[i].textContent = units
        }
    }
}

// check to see if the mouse is over a container. This is used when drawing skewers
$(".container").hover(function(){
    container_hover = true;
    }, function(){
    container_hover = false;
});



function deleteLine(idx){
    /**
     * * deleteLine() removes a skewer from the scene
     */
    let del = document.getElementById('skewer-coords-' + idx + '')
    del.remove()
    // let stat = document.getElementById('spectra-status-skewer-coords-' + idx + '')
    // stat.remove()
    scene.remove(lines[idx])
}

function retryLine(idx){
    /**
     * * retryLine() requests another spectrum if the first one did not compute
     */

    requestSpectrum(idx)
}

function requestSpectrum(idx){
    /**
     * * requestSpectrum() prepares and sends the coordinates of a skewer to the python backend for processing 
     * ? pt values are scaled since the voxelization process distorts the physical distances
     */
    
    pt1 = scalePointCoords(skewers[idx].point1)
    pt2 = scalePointCoords(skewers[idx].point2)
    
    buttonId = 'request-button-' + idx + ''
    div = document.getElementById(buttonId)
    div.disabled = true
    sendLine(idx,pt1,pt2)
    div.innerText = 'requesting spectrum . . . '

    function scalePointCoords(pt){
        x_scale = (edges_scaled.right_edge[0]-edges_scaled.left_edge[0])/(edges.right_edge[0] - edges.left_edge[0])
        y_scale = (edges_scaled.right_edge[1]-edges_scaled.left_edge[1])/(edges.right_edge[1] - edges.left_edge[1])
        z_scale = (edges_scaled.right_edge[2]-edges_scaled.left_edge[2])/(edges.right_edge[2] - edges.left_edge[2])
        pt.x = pt.x/x_scale
        pt.y = pt.y/y_scale
        pt.z = pt.z/z_scale
        return pt
    }

    function sendLine(idx,point1,point2){
        // socket.emit('selectRay',skewers.length-1, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
        socket.emit('selectRay',idx, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
    }
}


function plotSyntheticSpectrum(points) {
    /**
     * * plotSyntheticSpectrum() generates a new plot for the data it has received
     */

    // skewerData.push(points)
    data = []
    var margin = {top: 10, right: 30, bottom: 30, left: 30},
        width = 300 - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;
    for(i=0;i<points.lambda.length;i++){
        data[i] = { 'lambda': points.lambda[i], 'flux': points.flux[i] }
    }
    
    skewers[points.index] = ({'point1': {'x': points.start[0],'y': points.start[1],'z': points.start[2]}, 'point2':{'x': points.end[0],'y': points.end[1],'z': points.end[2]}, 'lambda': points.lambda, 'flux': points.flux })
    skewerData.push([points,data])
    
    
    // console.log(data)
    domainLambda = d3.extent(points.lambda)
    
    // console.log(domainLambda)
    xScale = d3.scaleLinear()
                .range([0, width + margin.left + margin.right])
                .domain(domainLambda);
                
    
    updateGraph()
    createBrush()
}

/**
 * * GRAPH PLOTTING
 */

function updateGraph(){
    var margin = {top: 10, right: 30, bottom: 30, left: 50},
    width = 300 - margin.left - margin.right,
    height = 200 - margin.top - margin.bottom;


    let ele = document.getElementsByName('x-axis-transform')
    for(i = 0; i < ele.length; i++) { 
        if(ele[i].checked) {
            ele = ele[i].value
        }
    }
    
    d3.select("#spectrum").selectAll(".graph").remove()

    if(skewerData.length){
        // console.log(skewerData.length)
        for(i=0;i<skewerData.length;i++){   
            // console.log(i)
            let data = []
            let idx = skewerData[i][0].index
            // console.log(idx)
            x = Array.from(skewers[idx].lambda)
            y = Array.from(skewers[idx].flux)

            if(ele == "Angstroms" && document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)"){
                // domainLambda = d3.extent(x)

                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': y[j] }
                }
            }
            else if(ele == "Velocity Space" && document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)"){
                let rest_lambda = parseFloat(document.getElementById("common-wavelengths").value)
                let c = 3e5;
                for( j = 0; j < x.length; j++ ){
                    delta_lambda = x[j] - rest_lambda;
                    x[j] = ( c * delta_lambda ) / rest_lambda;
                }
                // domainLambda = d3.extent(x)
                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                }
            }
            else{
                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                }
            }

            // console.log("plotted " + idx)

            var svg = d3.select("#spectrum")
                .append("svg")
                .attr("class","graph")
                .attr("id","graph-" + idx + '')
                .attr("width", width + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.append("defs").append("clipPath")
                .attr("id", "clip")
                .append("rect")
                .attr("width", width)
                .attr("height", height);
            // xScale = d3.scaleLinear()
            //     .range([0, width])
            //     .domain(d3.extent(skewerData[i].lambda));
            svg.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(xScale).ticks(6));
           
            // text label for the x axis
            svg.append("text")             
                .attr("transform", "translate(" + (width/2) + " ," + (height + margin.top + 30) + ")")
                .style("text-anchor", "middle")
                .text("λ")
            
            var yScale = d3.scaleLinear()
                .range([height, 0])
                .domain(d3.extent(skewers[idx].flux));
            svg.append("g")
                .call(d3.axisLeft(yScale));
            
            // text label for the y axis
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "0.9em")
                .style("text-anchor", "middle")
                .text("flux");

            var line = d3.line()
                .x(d => xScale(d.lambda))
                .y(d => yScale(d.flux))      

            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("d", line)

            svg.append("text")
                .attr("transform", "translate(-40,10)")
                .text(idx)
            
            
            if(lines[idx]){
                let id = "#graph-" + idx + ''
                $(id).hover(function(){
                    
                    lines[idx].material.color = new THREE.Color(0,1,0)
                    }, function(){
                        lines[idx].material.color = new THREE.Color(0xff5522)
                });
            }
        }
    }
}

function createBrush() {
    // https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
    d3.select('#spectrum').selectAll('#depth-brush').remove();
    let svg = d3.select('#spectrum').append('div').attr('id','depth-brush').append('svg')

    let margin = {top: 10, right: 15, bottom: 30, left: 30};
    let axis = svg.append('g');

    let brush = svg.append("g")
        .attr("class", "brush");

    let width = 300, height = 40
    let x = d3.scaleLinear()
        .domain(domainLambda)
        .range([margin.left, width]);

    resize();
    drawBrush();
    brushed();

    function resize() {
        var w = width - margin.right;
        var h = 40;

        var aspect = w / h;
        var vw = width;
        var vh = vw / aspect;

        width = vw;
        height = vh - margin.bottom;

        svg
            //.style("font-size", "2px")
            .attr('width', w).attr('height', h)
            .attr("viewBox", "0 0 " + vw + " " + vh)
            //.attr("text", "white")

        x.range([margin.left, width - margin.right]);

        axis.attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x).ticks(6))

    }

    function drawBrush() {
        if (!x) { return; }
        brusher = d3.brushX()
            .extent([[margin.left, 0], [width - margin.right, height]])
            .on("brush end", brushed);

        brush.call(brusher)
            .call(brusher.move, x.range());
    }

    function brushed() {
        var s = d3.event.selection || x.range();
        ret = s.map(x.invert, x);
        // console.log(s)
        // console.log(ret)
        if (ret[0] !== ret[1]) {
            
            updateLambdaDomain(ret[0],ret[1])
            updateGraph()

        }
    }
}

function updateLambdaDomain(min, max){
    if(min != undefined){
        domainLambda[0] = min
    }
    if(max != undefined){
        domainLambda[1] = max
    }
    xScale = d3.scaleLinear().domain(domainLambda).range([0, 210])
}

function commonWavelength(){
    val = parseFloat(document.getElementById("common-wavelengths").value)
    let ele = document.getElementsByName('x-axis-transform')
    for(i = 0; i < ele.length; i++) { 
        if(ele[i].checked) {
            ele = ele[i].value
        }
    }
    if(ele == "Angstroms"){
        updateLambdaDomain(val-5,val+5)
        console.log(domainLambda)
    }
    else if(ele == "Velocity Space"){
        updateLambdaDomain(-2000,2000)
    }
    updateGraph()
    createBrush()
}

function downloadSpectra(){
    
    var c = skewerData[0][0].lambda.map(function(e, i) {
        return [e, skewerData[0][0].flux[i]];
      });

    c = JSON.stringify(c)

    name = 'spectra.txt'
    const a = document.createElement('a');
	const type = name.split(".").pop();
	a.href = URL.createObjectURL( new Blob([c], { type: type} )) ;
	a.download = name;
	a.click();
}

/**
 * * WAIT UNTIL PAGE IS LOADED
 */

$(document).ready(function(){


    $(".container").hover(function(){
        container_hover = true;
        }, function(){
        container_hover = false;
    });
    
    init()
    animate()
    render()
    function init(){

        THREE.Cache.enabled = true
        canvas = document.createElement('canvas')
        context = canvas.getContext('webgl2', { alpha: false })
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color("rgb(4,6,23)")

        camera = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 0.00001, 4000 );
        
        camera.layers.enable(0);
        camera.layers.enable(1);
        camera.layers.enable(2);
        camera.layers.enable(3);
        camera.layers.enable(4);
        

        renderer = new THREE.WebGLRenderer( { canvas: canvas, context: context });
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.antialias = true;
        renderer.precision = 'highp';
        renderer.powerPreference = 'high-performance'
        renderer.sortPoints = true;
        renderer.gammaFactor = 2.2;
        renderer.gammaOutput = true;
        renderer.logarithmicDepthBuffer = false
        
        // camera.position.set(8.47, 8.47, 8.47)
        camera.position.set(128, 128, 128)

        camera.zoom = 6
        // camera.lookAt(0,0,0)
        camera.updateProjectionMatrix();

        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        // edges.right_edge[0]-edges.left_edge[0], edges.right_edge[1]-edges.left_edge[1], edges.right_edge[2]-edges.left_edge[2]
        // controls.target.set( 8.47/2, 8.47/2, 8.47/2 );

        controls.target.set( 64, 64, 64 );

        controls.update()

        // controls.enableDamping = true
        // controls.dampingFactor = 0.07;

        initMaterial();
        initColor();
        
        document.body.appendChild( renderer.domElement );
        document.addEventListener('keydown', onKeyDown, false)
        window.addEventListener( 'resize', onWindowResize, false );
        document.addEventListener( 'mousemove', onMouseMove, false );

        document.addEventListener( 'click', onMouseClick, false );
        document.addEventListener( 'wheel', onMouseWheel, false );


        // changeValue()
        // gm = document.querySelector('#gas-minval-input')
        // gm.addEventListener('input', changeVal('gas','min',document.getElementById('gas-minval-input').value),true);
        
        // gmx = document.querySelector('#gas-maxval-input')
        // gmx.addEventListener('input',changeVal('gas','min', document.getElementById('gas-maxval-input').value),true);
        
        // bhm = document.querySelector('#bh-minval-input')
        // bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
        
        // bhmx = document.querySelector('#bh-maxval-input')
        // bhmx.addEventListener('input',changeVal('bh','min', document.getElementById('bh-maxval-input').value),true);
        

        // function changeVal(type,e,val){
        //     if(type == 'gas' && e == 'min'){
        //         materialGas.uniforms.min.value = val
        //     }
        //     if(type == 'gas' && e == 'max'){
        //         materialGas.uniforms.max.value = val
        //     }   
        //     if(type == 'bh' && e == 'min'){
        //         materialBlackHole.uniforms.min.value = val
        //     }
        //     if(type == 'bh' && e == 'max'){
        //         materialBlackHole.uniforms.max.value = val
        //     }          
        // }

        gmc = document.querySelector("#gasMinCol")
        gmc.addEventListener('change',changeColor,false);
        gmxc = document.querySelector("#gasMaxCol")
        gmxc.addEventListener('change',changeColor,false);
        
        dmc = document.querySelector("#dmCol")
        dmc.addEventListener('change',changeColor,false);
        // dmxc = document.querySelector("#dmMaxCol")
        // dmxc.addEventListener('change',changeColor,false);

        smc = document.querySelector("#starCol")
        smc.addEventListener('change',changeColor,false);
        // smxc = document.querySelector("#starMaxCol")
        // smxc.addEventListener('change',changeColor,false);

        bmc = document.querySelector("#bhMinCol")
        bmc.addEventListener('change',changeColor,false);
        bmxc = document.querySelector("#bhMaxCol")
        bmxc.addEventListener('change',changeColor,false);

        refreshLoop();
        loadAttribute(128,'PartType0','DensityCGS')
        // loadData()
    }
    
    function onMouseMove( event ) {
        /**
         * * onMouseMove() is an event listener for when the mouse position changes
         */
        mouse.x = ( event.clientX - windowHalf.x );
        mouse.y = ( event.clientY - windowHalf.x );
        
    }
    function onMouseClick( event ) {
        /**
         * * onMouseClick() is an event listener for when the mouse is clicked. Mainly used for drawing skewers
         */
        
        //get mouse coordinates in screen space
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        //find start and end points on mouse click when drawSkewers is true
        if(drawSkewers && !container_hover){


            //this uses the position of the camera and the location of the mouse press
            //in order to generate a point in the space that passes from the camera through the mouse position
            planeNormal.copy(camera.position).normalize();
            plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, point);
            var geometry = new THREE.Geometry();
            ray1 = new THREE.Vector3(point.x,point.y,point.z)
            cd = new THREE.Vector3()
            camera.getWorldDirection(cd)
            
            //check to see if the mouse click intersects with invisible cube around the data
            if(raycaster.intersectObject(cube).length>0){
                //runs algorithm that finds two end points on surface of the cube
                findLineEnds(ray1,cd)    
            }
            
            function findLineEnds(ray,dir){
                /**
                 * * findLineEnds() gets the start and end points of a line drawn at the intersection between the mouse position and near and far sides of the cube
                 */

                //checks to see if the selected point is inside or outside of the domain of the data
                //in order to determine direction to move the points. incrementally moves the point
                //in the camera direction at a size delta until it reaches the boundary
                if(checkIfInside(ray)){
                    let point1 = ray.clone()
                    let point2 = ray.clone()
                    delta = 0.01

                    console.log('true')
                    

                    while(  (point1.x >= edges_scaled.left_edge[0] && point1.x <= edges_scaled.right_edge[0]) &&
                            (point1.y >= edges_scaled.left_edge[1] && point1.y <= edges_scaled.right_edge[1]) &&
                            (point1.z >= edges_scaled.left_edge[2] && point1.z <= edges_scaled.right_edge[2])){
                                
                                point1.x += delta*dir.x
                                point1.y += delta*dir.y
                                point1.z += delta*dir.z
                                
                    }
                    while(  (point2.x >= edges_scaled.left_edge[0] && point2.x <= edges_scaled.right_edge[0]) &&
                            (point2.y >= edges_scaled.left_edge[1] && point2.y <= edges_scaled.right_edge[1]) &&
                            (point2.z >= edges_scaled.left_edge[2] && point2.z <= edges_scaled.right_edge[2])){
                                
                                point2.x -= delta*dir.x
                                point2.y -= delta*dir.y
                                point2.z -= delta*dir.z
                    }
                    
                    printLine(point1,point2)
                }
                else{
                    console.log('false')
                    let point1 = ray.clone()
                    delta = 0.01
                    
                    while(  (point1.x <= edges_scaled.left_edge[0] || point1.x >= edges_scaled.right_edge[0]) ||
                            (point1.y <= edges_scaled.left_edge[1] || point1.y >= edges_scaled.right_edge[1]) ||
                            (point1.z <= edges_scaled.left_edge[2] || point1.z >= edges_scaled.right_edge[2])){            
                                if( dir.x+dir.y+dir.z <= 0 )  {   
                                    point1.x -= delta*dir.x
                                    point1.y -= delta*dir.y
                                    point1.z -= delta*dir.z
                                }
                                else{
                                    point1.x -= delta*dir.x
                                    point1.y -= delta*dir.y
                                    point1.z -= delta*dir.z
                                }
                    }
                    // console.log('1/2')

                    let point2 = point1.clone()
                    while(  (point2.x >= edges_scaled.left_edge[0] && point2.x <= edges_scaled.right_edge[0]) &&
                            (point2.y >= edges_scaled.left_edge[1] && point2.y <= edges_scaled.right_edge[1]) &&
                            (point2.z >= edges_scaled.left_edge[2] && point2.z <= edges_scaled.right_edge[2])){
                                if( dir.x+dir.y+dir.z <= 0 )  {
                                    point2.x -= delta*dir.x
                                    point2.y -= delta*dir.y
                                    point2.z -= delta*dir.z
                                }
                                else{
                                    point2.x -= delta*dir.x
                                    point2.y -= delta*dir.y
                                    point2.z -= delta*dir.z
                                }

                    }
                    // console.log('2/2')
                    handleLine(dir,point1,point2)
                    // printLine(dir,point1,point2)
                }
                function handleLine(dir,point1,point2){
                    /**
                     * * handleLine() sends the line data to several destinations, to be drawn, saved, etc
                     */

                    idx = skewers.length
                    updateSkewerList(dir,idx,point1,point2)
                    saveLine(idx,point1,point2)
                    // sendLine(idx,point1,point2)
                    printLine(idx,point1,point2)
                }
                function printLine(idx,point1,point2){
                    /**
                     * * printLine() draws the skewer in the scene
                     */

                    positions = []
                    geometry = new THREE.LineGeometry();
                    positions.push(point1.x,point1.y,point1.z);
                    positions.push(point2.x,point2.y,point2.z);
                    geometry.setPositions(positions)
                    scene.remove(lines[idx])
                    var material = new THREE.LineMaterial( { 
                        color: 0xff5522,
                        linewidth: 0.01,
                        transparent: true,
                        opacity: 0.7,
                        blending: THREE.AdditiveBlending

                    } );
                    lines[idx] = new THREE.Line2( geometry, material );
                    lines[idx].layers.set(4)
                    scene.add( lines[idx] );
                }

                

                function updateSkewerList(dir,idx,point1,point2){

                    /**
                     * * updateSkewerList() updates the skewer container UI for the corresponding line
                     */

                    dist = Math.sqrt( Math.pow((point1.x - point2.x),2) + Math.pow((point1.y - point2.y),2) + Math.pow((point1.z - point2.z),2))
                    //create div to hold skewer details
                    div = document.getElementById('skewer-coords')
                    id = 'skewer-coords-' + idx
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords" id="' + id + '"></div>');
                    
                    $("#" + id).hover(function(){
                        lines[idx].material.color = new THREE.Color(0,1,0)
                        }, function(){
                            lines[idx].material.color = new THREE.Color(0xff5522)
                    });
                    
                    //create div to show the line idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-number-' + idx
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-number" id='+ id +'>' + idx + ' <img id="delete-icon-"' + idx + '" class="delete-icon" src="static/assets/delete.svg" alt="delete line" role="button" onclick="deleteLine('+idx+')"  /> <img id="retry-icon-"' + idx + '" class="retry-icon" src="static/assets/refresh.svg" alt="retry line" role="button" onclick="retryLine('+idx+')"  /> </div>')

                    //create div to show pt1 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt1-range-' + idx + ''
                    id_range = "p1-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt1-range" id='+ id +'>point 1:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0"></div></div>')
                    div = document.getElementById(id)
                    id = "skewer-coords-point1-" + idx + ''
                    div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(point1.x,3) + ', ' + round(point1.y,3) + ', ' + round(point1.z,3) + ' )</div>')

                    //create div to show pt2 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt2-range-' + idx + ''
                    id_range = "p2-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt2-range" id="'+ id +'">point 2:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0"></div></div>')
                    div = document.getElementById(id)
                    id = "skewer-coords-point2-" + idx + ''
                    div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id="' + id + '">( ' + round(point2.x,3) + ', ' + round(point2.y,3) + ', ' + round(point2.z,3) + ' ) </div>')

                    //create event listeners for the range sliders
                    p1slider = document.getElementById('p1-range-' + idx + '')
                    p1slider.oninput = function() {
                        slider = document.getElementById('p1-range-' + idx + '')
                        pt1 = []
                        pt1.x = point1.x - slider.value*dir.x
                        pt1.y = point1.y - slider.value*dir.y
                        pt1.z = point1.z - slider.value*dir.z

                        slider = document.getElementById('p2-range-' + idx + '')
                        pt2 = []
                        pt2.x = point2.x + slider.value*dir.x
                        pt2.y = point2.y + slider.value*dir.y
                        pt2.z = point2.z + slider.value*dir.z

                        id = "skewer-coords-point1-" + idx + ''
                        div = document.getElementById(id)
                        div.innerHTML = ''
                        div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt1.x,3) + ', ' + round(pt1.y,3) + ', ' + round(pt1.z,3) + ' )</div>')    
                        printLine(idx,pt1,pt2)
                        saveLine(idx,pt1,pt2)
                    }

                    //create event listeners for the range sliders
                    p2slider = document.getElementById('p2-range-' + idx + '')
                    p2slider.oninput = function() {
                        slider = document.getElementById('p1-range-' + idx + '')
                        pt1 = []
                        pt1.x = point1.x - slider.value*dir.x
                        pt1.y = point1.y - slider.value*dir.y
                        pt1.z = point1.z - slider.value*dir.z

                        slider = document.getElementById('p2-range-' + idx + '')
                        pt2 = []
                        pt2.x = point2.x + slider.value*dir.x
                        pt2.y = point2.y + slider.value*dir.y
                        pt2.z = point2.z + slider.value*dir.z
                        
                        id = "skewer-coords-point2-" + idx + ''
                        div = document.getElementById(id)
                        div.innerHTML = ''
                        div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt2.x,3) + ', ' + round(pt2.y,3) + ', ' + round(pt2.z,3) + ' )</div>')    
                        printLine(idx,pt1,pt2)
                        saveLine(idx,pt1,pt2)   
                    }

                    //create div for REQUEST button and STATUS message below skewer details
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords spectra-status" id="spectra-status-' + id + '">   <button type="button" onclick="requestSpectrum('+idx+')" class="request-button button spectra-status" id="request-button-' + idx + '">request spectrum</button> </div>');
                    div.insertAdjacentHTML('afterend', '<hr>')
                    
                }

                function saveLine(idx,point1,point2){
                    /**
                     * * saveLine() stores the coordinates in the skewer array for later reference
                     */
                    skewers[idx] = {
                        point1: point1,
                        point2: point2
                    }
                }

                function checkIfInside(ray){
                    /**
                     * * checkIfInside() is used to determine if the raycasted ray is within the boundaries of the data cube
                     */
                    if( (ray.x >= edges_scaled.left_edge[0] && ray.x <= edges_scaled.right_edge[0]) &&
                        (ray.y >= edges_scaled.left_edge[1] && ray.y <= edges_scaled.right_edge[1]) &&
                        (ray.z >= edges_scaled.left_edge[2] && ray.z <= edges_scaled.right_edge[2]) ){
                            return true
                        }
                    else{
                        return false
                    }
                }
            }
        }
        
    }
    
    function onMouseWheel( event ) {
    
    //   camera.position.z += event.deltaY * 0.01; // move camera along z-axis
    
    }

    function initColor(){
        // var color_picker = document.getElementsByClassName("color-picker");
        // for(i=0;i<color_picker.length;i++){
        //     color_picker[i].style.backgroundColor =  
        // }

        if( localStorage.getItem('gasMinCol') ){
            document.querySelector("#gasMinCol").value = localStorage.getItem('gasMinCol');
            document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
        }
        else{
            document.querySelector("#gasMinCol").value = '#ffffff';
        }
        document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
        
        if( localStorage.getItem('gasMaxCol') ){
            document.querySelector("#gasMaxCol").value = localStorage.getItem('gasMaxCol');
        }
        else{
            document.querySelector("#gasMaxCol").value = '#ffffff';
        }
        document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value

        
        if( localStorage.getItem('dmCol') ){
            document.querySelector("#dmCol").value = localStorage.getItem('dmCol');
        }
        else{
            document.querySelector("#dmCol").value = '#ffffff';
        }
        document.querySelector("#dmCol").style.backgroundColor = document.querySelector("#dmCol").value

        
        if( localStorage.getItem('starCol') ){
            document.querySelector("#starCol").value = localStorage.getItem('starCol');
        }
        else{
            document.querySelector("#starCol").value = '#ffffff';
        }
        document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value


        if( localStorage.getItem('bhMinCol') ){
            document.querySelector("#bhMinCol").value = localStorage.getItem('bhMinCol');
        }
        else{
            document.querySelector("#bhMinCol").value = '#ffffff';
        }
        document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value


        if( localStorage.getItem('bhMaxCol') ){
            document.querySelector("#bhMaxCol").value = localStorage.getItem('bhMaxCol');
        }
        else{
            document.querySelector("#bhMaxCol").value = '#ffffff';
        }
        document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value


        changeColor()
    }   

    function initMaterial(){

        gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
        gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);

        dmCol = new THREE.Color(document.querySelector("#dmCol").value);
        // dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);

        starCol = new THREE.Color(document.querySelector("#starCol").value);
        // starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);

        bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
        bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

        materialGas = new THREE.ShaderMaterial( {

            uniforms: {

                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                min: { value: 0.0 },
                max: { value: 1.0 },
                minClip: { value: false },
                maxClip: { value: false },
                minCol: { value: new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0) },
                maxCol: { value: new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-gas' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-gas' ).textContent,

            blending:       THREE.AdditiveBlending,
            blendEquation: THREE.AddEquation, //default
            blendSrc: THREE.OneFactor,
            blendDst: THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     true,
            transparent:    true,
            // alphaTest:      0.1,
            opacity:    1.0,
            dithering: true


        });
        materialDarkMatter = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                Col: { value: new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0) },
                // maxCol: { value: new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0) }
            
            },
            vertexShader:   document.getElementById( 'vertexshader-darkmatter' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-darkmatter' ).textContent,

            blending:       THREE.AdditiveBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.2

        });
        materialBlackHole = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                min: { value: 0.0 },
                max: {value: 0.0 },
                minClip: { value: false },
                maxClip: { value: false },
                minCol: { value: new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0) },
                maxCol: { value: new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-blackhole' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-blackhole' ).textContent,
            

            // blending:       THREE.AdditiveBlending,
            blending:       THREE.CustomBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.3

        });

        materialStar = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                Col: { value: new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0) },
                // maxCol: { value: new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-star' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-star' ).textContent,

            // blending:       THREE.AdditiveBlending,
            blending:       THREE.CustomBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.3

        });
    }

    function onWindowResize(){

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    
        // renderer.setSize( window.innerWidth, window.innerHeight );
        resizeRendererToDisplaySize(renderer)
        function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width  = window.innerWidth  * pixelRatio | 0;
        const height = window.innerHeight * pixelRatio | 0;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height);
        }
        return needResize;
        }
    
    }

    function onKeyDown(event){
        // console.log(event)
        var k = String.fromCharCode(event.keyCode);
        // console.log(k)

        const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    }

    function exportData(name, text) {

        const a = document.createElement('a');
        const type = name.split(".").pop();
        a.href = URL.createObjectURL( new Blob([text], { type:`text/${type === "txt" ? "plain" : type}` }) );
        a.download = name;
        a.click();
    }
})
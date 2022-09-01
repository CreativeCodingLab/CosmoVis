/**
 * ! CosmoVis - Volumetric Rendering version
 */


/**
 * * Instantiate global variables
 */

 var container //floating GUI containers

 var camera, scene, renderer, material, skewerScene //THREE.js environment variables
 var tex1 = new THREE.TextureLoader().load("static/textures/blur.png");
 const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
 var field_list //contains list of particle fields
 var dataArray3D, dataTexture3D, volumeShader, volumeUniforms, volMaterial, volGeometry
 
 var gasMinCol, gasMidCol, gasMaxCol, dmMinCol, dmMaxCol, starMinCol, starMaxCol, bhMinCol, bhMaxCol //stores colors for different particle types
 var gm, gmx, bhm, bhmx //used for changeValue()
 var brusher //used for spectra brush
 var gui //used to hold dat.GUI object
 // var material
 var cmtexture = []
 var gasTexture, dmTexture
 var gasAttr = "Temperature"
 var uniforms
 var densityTexture, densityMin, densityMax
 var gasMesh, dmMesh, starMesh, bhMesh
 var dataArray3D, dataTexture3D, volumeShader, volumeUniforms, volMaterial, volGeometry
 var gasMaterial, dmMaterial, starMaterial, starSaoMaterial, bhMaterial, skewerMaterial
 var skewerMaterial1 = []
 var skewerTexture = []
 var climGasLimits = []
 var climDMLimits = []
 var climStarLimits = []
 var climBHLimits = []
 var gridsize = 64 //parseInt(document.getElementById('size_select').value)
 var simID = ''
 var oldSimID = ''
 var simSize
 var staticGrid
 var xBrusher, yBrusher, zBrusher, xBrush, yBrush, zBrush
 var blank_d = new Float32Array(gridsize * gridsize * gridsize)
 for (x = 0; x < gridsize; x++) {
     for (y = 0; y < gridsize; y++) {
         for (z = 0; z < gridsize; z++) {
             blank_d[x + y * gridsize + z * gridsize * gridsize] = 1.0
         }
     }
 }
 // //console.log(d)
 blankTexture = new THREE.DataTexture3D(blank_d, gridsize, gridsize, gridsize)
 blankTexture.format = THREE.RedFormat
 blankTexture.type = THREE.FloatType
 blankTexture.minFilter = blankTexture.magFilter = THREE.LinearFilter
 blankTexture.unpackAlignment = 1
 blank_d = []
 var elements = ['Hydrogen', 'Helium', 'Carbon', 'Nickel', 'Oxygen', 'Neon', 'Magnesium', 'Silicon', 'Iron']
 // var volconfig
 
 /**
  * * these variables are used for raycasting when drawing skewers
  */
 var cube
 const mouse = new THREE.Vector2();
 var raycaster = new THREE.Raycaster(); // this one is for the skewers
 raycaster.layers.set(8)
 var starcaster = new THREE.Raycaster();
 starcaster.params.Points.threshold = 1;
 starcaster.layers.set(3);
 var starGalaxyInfo
 var plane = new THREE.Plane();
 var planeNormal = new THREE.Vector3();
 var point = new THREE.Vector3();
 var edges = []
 // for zooming in:
 var zoomEdges = []
 var zoom_bool = false
 var halos
 // //
 var skewers = []
 var drawSkewers = false
 var line
 var lines = []
 var skewer_endpoints = []
 var container_hover //used to determine if the mouse is over a GUI container when drawing skewers
 var edges_scaled = []
 var domainXYZ = [0.0, 1.0, 0.0, 1.0, 0.0, 1.0]
 
 var starScene, starSaoScene, skewerScene
 var starTarget //used for rendering star particles to depth texture
 var starSaoTarget //ambient occlusion render target
 var skewerTarget
 var boxOfStarPoints
 var starData
 var width_Mpc
 var galaxy_centers
 /**
  * * used with refreshLoop() to get fps
  */
 const times = [];
 let fps;
 
 function refreshLoop() {
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
 
 refreshLoop();
 
 var camPos;
 var oldSize
 var oldPos
 
 let renderRequested = false
 
 // var staticGrid;
 
 /**
  * * GLOBAL FUNCTIONS 
  */
 
 // FH loading galaxy query data globally
 
 // var galQueryData
 
 // fetch('static/data/eagle12_z0_ms7.json')
 // .then(response => {
 //    return response.json();
 // })
 // .then(data => {
 //     galQueryData = data
 //     //console.log(galQueryData)}
 //     );
 
 // FH - for going back to full box view:
 // window.addEventListener('dblclick', (e) => {
 // // updateXYZDomain('x',0.0,1.0) 
 // // updateXYZDomain('y',0.0,1.0) 
 // // updateXYZDomain('z',0.0,1.0)
 // // console.log('dblclk',width_Mpc/2)
 // goToPoint(width_Mpc/2,width_Mpc/2,width_Mpc/2,0.5)
 // camera.zoom = 1.0
 // camera.updateProjectionMatrix()
 // updateUniforms() 
 // })
 
 function storeSceneState() {
     sceneState = {}
     // simulation snapshot
     sceneState.simID = simID
     // layer visibility
     sceneState.gas = volMaterial.uniforms["u_gasVisibility"].value
     sceneState.dm = volMaterial.uniforms["u_dmVisibility"].value
     sceneState.stars = volMaterial.uniforms["u_starVisibility"].value
     // camera orientation/location
     sceneState.camera = camera.matrix.toArray()
     sceneState.cameraZoom = camera.zoom
     // XYZ slice
     sceneState.domainXYZ = domainXYZ
 
     // min/max for transfer function
     // save sceneState
 
     c = JSON.stringify(sceneState)
 
     let fn = 'sceneState.json'
     const a = document.createElement('a');
     const type = fn.split(".").pop();
     a.href = URL.createObjectURL(new Blob([c], { type: type }));
     a.download = fn;
     a.click();
 }
 
 var newSceneState = {}
 function restoreSceneState() {
     var input = document.createElement('input');
     input.type = 'file';
 
     input.onchange = e => {
 
         // getting a hold of the file reference
         var file = e.target.files[0];
 
         // setting up the reader
         var reader = new FileReader();
         reader.readAsText(file, 'UTF-8');
 
         // here we tell the reader what to do when it's done reading...
         reader.onload = readerEvent => {
             newSceneState = JSON.parse(readerEvent.target.result); // this is the content!
             //console.log(newSceneState);
 
             // simID = newSceneState.simID
             document.getElementById("sim_size_select").value = newSceneState.simID
             document.getElementById("size_select").value = 64
 
             updateSize()
             checkSelectedSimID()
 
             volMaterial.uniforms["u_gasVisibility"].value = newSceneState.gas
             volMaterial.uniforms["u_dmVisibility"].value = newSceneState.dm
             volMaterial.uniforms["u_starVisibility"].value = newSceneState.stars
 
             camera.matrix.fromArray(newSceneState.camera)
             camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)
 
             camera.zoom = newSceneState.cameraZoom
             domainXYZ = newSceneState.domainXYZ
             updateXYZDomain('x', domainXYZ[0], domainXYZ[1])
             updateXYZDomain('y', domainXYZ[2], domainXYZ[3])
             updateXYZDomain('z', domainXYZ[4], domainXYZ[5])
 
             let margin = { top: 20, right: 15, bottom: 30, left: 20 };
             let width = 300 - margin.left - margin.right,
                 height = 40
             var x = d3.scaleLinear()
                 .domain([0.0, 1.0])
                 .range([margin.left + width * domainXYZ[0], margin.left + width * domainXYZ[1]]);
             xBrush.call(xBrusher).call(xBrusher.move, x.range())
 
             var y = d3.scaleLinear()
                 .domain([0.0, 1.0])
                 .range([margin.left + width * domainXYZ[2], margin.left + width * domainXYZ[3]]);
             yBrush.call(yBrusher).call(yBrusher.move, y.range())
 
             var z = d3.scaleLinear()
                 .domain([0.0, 1.0])
                 .range([margin.left + width * domainXYZ[4], margin.left + width * domainXYZ[5]]);
             zBrush.call(zBrusher).call(zBrusher.move, z.range())
 
 
             updateUniforms()
         }
 
     }
 
     input.click();
 }
 
 
 
 
 // // load sceneState
 // var file = document.getElementById('file').files[0];
 // if(file){
 //     var reader = new FileReader();
 
 //     // Read file into memory as UTF-16
 //     reader.readAsText(file, "UTF-16");
 
 //     // Handle progress, success, and errors
 //     reader.onload = loaded;
 //     reader.onerror = errorHandler;
 
 // }
 
 // function loaded(evt) {
 //     // Obtain the read file data
 //     var newSceneState = evt.target.result;
 
 //     simID = newSceneState.simID
 //     volMaterial.uniforms["u_gasVisibility"].value  = newSceneState.gas
 //     volMaterial.uniforms["u_dmVisibility"].value   = newSceneState.dm
 //     volMaterial.uniforms["u_starVisibility"].value = newSceneState.stars
 
 //     camera = newSceneState.camera
 
 //     domainXYZ = newSceneState.domainXYZ
 // }
 
 // function errorHandler(evt) {
 //     if(evt.target.error.name == "NotReadableError") {
 //         // The file could not be read
 //     }
 // }      
 // }
 
 function clearThree(obj) {
     /**
      * * removes THREE.js objects and materials from memory more efficiently than just by setting `scene = []`
      */
     while (obj.children.length > 0) {
         clearThree(obj.children[0])
         obj.remove(obj.children[0]);
     }
     if (obj.geometry) obj.geometry.dispose()
 
     if (obj.material) {
         //in case of map, bumpMap, normalMap, envMap ...
         Object.keys(obj.material).forEach(prop => {
             if (!obj.material[prop])
                 return
             if (typeof obj.material[prop].dispose === 'function')
                 obj.material[prop].dispose()
         })
         obj.material.dispose()
     }
 }
 
 function clearLayer(l) {
     /**
      * * removes material from THREE.js layer to free up memory
      */
 
     for (i = scene.children.length - 1; i >= 0; i--) {
         layer = scene.children[i].layers.mask
         if (l == 0 && layer == 1) {
             //console.log('clear')
             scene.remove(scene.children[i])
         }
         if (l == 1 && layer == 2) {
             scene.remove(scene.children[i])
         }
         if (l == 2 && layer == 3) {
             scene.remove(scene.children[i])
         }
         if (l == 3 && layer == 4) {
             scene.remove(scene.children[i])
         }
         if (l == 8 && layer == 256) {
             scene.remove(scene.children[i])
             //console.log('clear')
         }
         if (l == 9 && layer == 512) {
             scene.remove(scene.children[i])
             //console.log('clear')
         }
         if (l == 10 && layer == 1024) {
             scene.remove(scene.children[i])
         }
     }
 
 }
 
 // // OG updatesize fn:
 // async function updateSize() {
 //     s = document.getElementById("size_select").value
 //         //check to see if selected size is different than the current configuration
 
 //     oldSize = gridsize
 //     oldPos = camera.position
 
 //     if (gridsize != s) {
 //         gridsize = s
 //         var init = init3dDataTexture(gridsize)
 
 //         asyncCall(true)
 //             //check to see which variables are visible and update those immediately
 //         checkSelectedSimID()
 //             // asyncCall()
 //             // loadHaloCenters()
 
 //         createSkewerCube(gridsize)
 //         updateSkewerEndpoints(gridsize, oldSize)
 //         toggleXYZGuide()
 //         updateUniforms()
 //         toggleGrid()
 //         camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
 //         camera.updateProjectionMatrix()
 //             // controls
 //         controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
 //         controls.update()
 //     }
 // }
 
 
 // FH updatesize fn:
 async function updateSize(zoom_bool, halos = null) {
 
     s = document.getElementById("size_select").value
     // console.log('hey now',s)
     //check to see if selected size is different than the current configuration
 
     oldSize = gridsize
     oldPos = camera.position
 
     //
     // console.log('what updates are there',gridsize,s)
 
     // s2.onchange = function() {
     // console.log('There was a change')
 
     // }
 
     //
 
     // if (halos) {
     //     console.log('heyyyyy')
     // }
 
     if (gridsize != s) {
 
         // console.log('are you there',s,gridsize)
 
         if (!zoom_bool) { //this is for non zoom-ins
             // if (!halos) {
             // console.log('are you there',s,gridsize,zoom_bool,halos)
 
             gridsize = s
 
             var init = init3dDataTexture(gridsize)
 
             asyncCall(true)
             //check to see which variables are visible and update those immediately
             checkSelectedSimID()
             // asyncCall()
             // loadHaloCenters()
 
             createSkewerCube(gridsize)
             updateSkewerEndpoints(gridsize, oldSize)
             toggleXYZGuide()
             updateUniforms()
             toggleGrid()
             camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
             camera.updateProjectionMatrix()
             // controls
             controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
             controls.update()
         }
 
         if (zoom_bool) { //this is for zoom-ins
             // if (halos) {
 
             gridsize = s
 
             var init = init3dDataTexture(gridsize)
 
             // console.log('no i am here instead',gridsize,s,zoom_bool,halos) 
 
             asyncZoom(true, halos)
             //check to see which variables are visible and update those immediately
             // checkSelectedSimID()
 
             createSkewerCube(gridsize)
             updateSkewerEndpoints(gridsize, oldSize)
             toggleXYZGuide()
             updateUniforms()
             toggleGrid()
             camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
             camera.updateProjectionMatrix()
             // controls
             controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
             controls.update()
         }
     }
 
     // if (gridsize != s) {
 
     //     gridsize = s
 
     //     // var init = init3dDataTexture(gridsize)
 
     //     // asyncZoom(true,halos)        
     //     //     //check to see which variables are visible and update those immediately
     //     // checkSelectedSimID()
     //     //     // asyncCall()
     //     //     // loadHaloCenters()
 
     //     // createSkewerCube(gridsize)
     //     // updateSkewerEndpoints(gridsize, oldSize)
     //     // toggleXYZGuide()
     //     // updateUniforms()
     //     // toggleGrid()
     //     // camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
     //     // camera.updateProjectionMatrix()
     //     //     // controls
     //     // controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
     //     // controls.update()
 
 
     // }
 }
 
 
 function toggleGrid() {
     let div = (document.getElementById("grid-check")).checked
     let divGridRadio1 = (document.getElementById("grid-radio-1")).checked
     let divGridRadio2 = (document.getElementById("grid-radio-2")).checked
 
     if (div) {
         clearLayer(9)
         if (divGridRadio1) {
             createStaticGrid()
         }
         if (divGridRadio2) {
             createBoundariesGrid()
         }
 
         createSkewerCube(gridsize)
         updateSkewerEndpoints(gridsize)
         toggleXYZGuide()
         updateUniforms()
 
 
     } else {
         clearLayer(9)
         updateUniforms()
     }
 
 }
 
 function toggleXYZGuide() {
 
     let div = (document.getElementById("xyzguide-check")).checked
     if (div) {
         var axesHelper = new THREE.AxesHelper(gridsize);
         axesHelper.layers.set(10)
         scene.add(axesHelper);
     } else {
         clearLayer(10)
     }
 }
 
 function updateSkewerEndpoints(size) {
     //console.log('update skewer endpoints')
     for (i = 0; i < lines.length; i++) {
         const mat = lines[i].material.clone()
         console.log(mat)
         skewerScene.remove(lines[i])
 
         point1 = new THREE.Vector3(skewer_endpoints[i][0][0], skewer_endpoints[i][0][1], skewer_endpoints[i][0][2])
         point2 = new THREE.Vector3(skewer_endpoints[i][1][0], skewer_endpoints[i][1][1], skewer_endpoints[i][1][2])
         skewerGeometry = cylinderMesh(point1.multiplyScalar(size), point2.multiplyScalar(size))
         skewerGeometry.DefaultUp = new THREE.Vector3(0, 0, 1);
 
         skewerGeometry.updateMatrix();
         skewerGeometry.verticesNeedUpdate = true;
         skewerGeometry.elementsNeedUpdate = true;
         skewerGeometry.morphTargetsNeedUpdate = true;
         skewerGeometry.uvsNeedUpdate = true;
         skewerGeometry.normalsNeedUpdate = true;
         skewerGeometry.colorsNeedUpdate = true;
         skewerGeometry.tangentsNeedUpdate = true;
 
         // //console.log(skewerGeometry)
         // render()
 
 
         // lines[idx] = new THREE.Line2( geometry, material );
         lines[i] = skewerGeometry
         lines[i].material = mat
         lines[i].layers.set(4)
         skewerScene.add(lines[i]);
 
     }
 }
 
 function createStaticGrid() {
     clearLayer(9)
 
     gridMaterial = new THREE.MeshBasicMaterial
 
     var divisions = simSize;
 
     staticGrid = new THREE.GridHelper(gridsize * 1.7, divisions * 1.7, new THREE.Color(0x222222), new THREE.Color(0x444444))
     staticGrid.position.set(gridsize / 2, gridsize / 2, gridsize / 2)
     staticGrid.layers.set(9)
     staticGrid.material.transparent = true;
     staticGrid.material.alpha = 0.01;
     // gridHelper.translateX( gridsize / 2);
     // gridHelper.translateY( gridsize / 2);
     // gridHelper.translateZ( gridsize / 2);
     staticGrid.side = THREE.DoubleSide
     scene.add(staticGrid);
 }
 
 function createBoundariesGrid() {
     clearLayer(9)
 
     divisions = simSize
 
     var gridHelper = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper.position.set(0, -gridsize / 2, 0)
     gridHelper.layers.set(9)
     gridHelper.material.transparent = true;
     gridHelper.material.alpha = 0.01;
     gridHelper.translateX(gridsize / 2);
     gridHelper.translateY(gridsize / 2);
     gridHelper.translateZ(gridsize / 2);
     gridHelper.side = THREE.DoubleSide
     scene.add(gridHelper);
 
     var gridHelper1 = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper1.position.set(0, 1 * gridsize, -gridsize / 2)
     gridHelper1.rotateX(Math.PI / 2)
     gridHelper1.layers.set(9)
     gridHelper1.material.transparent = true;
     gridHelper1.material.alpha = 0.01;
     gridHelper1.translateX(gridsize / 2);
     gridHelper1.translateY(gridsize / 2);
     gridHelper1.translateZ(gridsize / 2);
     gridHelper1.side = THREE.DoubleSide
     scene.add(gridHelper1);
 
     var gridHelper2 = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper2.position.set(gridsize / 2, 0, 0)
     gridHelper2.rotateZ(Math.PI / 2)
     gridHelper2.layers.set(9)
     gridHelper2.material.transparent = true;
     gridHelper2.material.alpha = 0.01;
     gridHelper2.translateX(gridsize / 2);
     gridHelper2.translateY(gridsize / 2);
     gridHelper2.translateZ(gridsize / 2);
     gridHelper2.side = THREE.DoubleSide
     scene.add(gridHelper2);
 
     var gridHelper3 = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper3.position.set(0, gridsize / 2, 0)
     gridHelper3.layers.set(9)
     gridHelper3.material.transparent = true;
     gridHelper3.material.alpha = 0.01;
     gridHelper3.translateX(gridsize / 2);
     gridHelper3.translateY(gridsize / 2);
     gridHelper3.translateZ(gridsize / 2);
     gridHelper3.side = THREE.DoubleSide
     scene.add(gridHelper3);
 
     var gridHelper4 = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper4.position.set(0, 1 * gridsize, gridsize / 2)
     gridHelper4.rotateX(Math.PI / 2)
     gridHelper4.layers.set(9)
     gridHelper4.material.transparent = true;
     gridHelper4.material.alpha = 0.01;
     gridHelper4.translateX(gridsize / 2);
     gridHelper4.translateY(gridsize / 2);
     gridHelper4.translateZ(gridsize / 2);
     gridHelper4.side = THREE.DoubleSide
     scene.add(gridHelper4);
 
     var gridHelper5 = new THREE.GridHelper(gridsize, divisions, new THREE.Color(0x005817), new THREE.Color(0x005817));
     gridHelper5.position.set(1.5 * gridsize, 0, 0)
     gridHelper5.rotateZ(Math.PI / 2)
     gridHelper5.layers.set(9)
     gridHelper5.material.transparent = true;
     gridHelper5.material.alpha = 0.01;
     gridHelper5.translateX(gridsize / 2);
     gridHelper5.translateY(gridsize / 2);
     gridHelper5.translateZ(gridsize / 2);
     gridHelper5.side = THREE.DoubleSide
     scene.add(gridHelper5);
 }
 
 function toggleXYZGuide() {
 
     let div = (document.getElementById("xyzguide-check")).checked
     if (div) {
         var axesHelper = new THREE.AxesHelper(gridsize);
         axesHelper.layers.set(10)
         scene.add(axesHelper);
     } else {
         clearLayer(10)
     }
     updateUniforms()
 }
 
 // function updateSkewerEndpoints(size){
 //     for(i=0;i<lines.length;i++){
 //         lines[i].scale.x = size
 //         lines[i].scale.y = size
 //         lines[i].scale.z = size
 //     }
 // }
 
 function updateUniforms() {
     if (volMaterial) {
         // //console.log("update uniforms")
 
 
         // controls.target.set( ((domainXYZ[1]+domainXYZ[0]) * gridsize)/2,  ((domainXYZ[3]+domainXYZ[2]) * gridsize)/2, ((domainXYZ[5]+domainXYZ[4])*gridsize)/2 );
         // controls.update()
         // camera.lookAt(controls.target.set( ((domainXYZ[1]-domainXYZ[0]) * gridsize)/2,  ((domainXYZ[3]-domainXYZ[2]) * gridsize)/2, ((domainXYZ[5]-domainXYZ[4])*gridsize)/2 ))
         // camera.updateProjectionMatrix();
 
 
         skewerMaterial.uniforms["u_xyzMin"].value = new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4])
         skewerMaterial.uniforms["u_xyzMax"].value = new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5])
         skewerMaterial.uniforms["u_gridsize"].value = gridsize
 
         starMaterial.uniforms["u_xyzMin"].value = new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4])
         starMaterial.uniforms["u_xyzMax"].value = new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5])
         starMaterial.uniforms["u_gridsize"].value = gridsize
         starMaterial.uniforms["u_starSize"].value = document.getElementById("star-size-slider").value
 
         starSaoMaterial.uniforms["u_screenHeight"].value = window.innerHeight
         starSaoMaterial.uniforms["u_screenWidth"].value = window.innerWidth
 
         volMaterial.uniforms["u_screenHeight"].value = window.innerHeight
         volMaterial.uniforms["u_screenWidth"].value = window.innerWidth
 
 
         for (i = 0; i < lines.length; i++) {
             lines[i].material.uniforms["u_xyzMin"].value = new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4])
             lines[i].material.uniforms["u_xyzMax"].value = new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5])
         }
 
         //check if grayscale depth is enabled
         // g_mod = (document.getElementById("grayscale-mod-check").checked ? 1.0 : 0.0);
         // volMaterial.uniforms[ "u_grayscaleDepthMod" ].value = g_mod;
 
         //step size
         // volMaterial.uniforms[ "u_stepSize" ].value = document.getElementById("step-size").value
         volMaterial.uniforms["u_exposure"].value = document.getElementById("exposure").value
 
         //cutting sliders
         volMaterial.uniforms["u_xyzMin"].value = new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4])
         volMaterial.uniforms["u_xyzMax"].value = new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5])
 
         skewerMaterial.uniforms["u_xyzMin"].value = new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4])
         skewerMaterial.uniforms["u_xyzMax"].value = new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5])
 
 
         // volMaterial.uniforms[ "u_distModI" ].value = (document.getElementById("dist-mod-intensity")).value
         volMaterial.uniforms["u_valModI"].value = (document.getElementById("val-mod-intensity")).value
 
 
         d_mod = 1.0 // (document.getElementById("density-mod-check").checked ? 1.0 : 0.0);
 
         //do stuff with h_number_density
         densityMin = document.getElementById('density-minval-input').value
         densityMax = document.getElementById('density-maxval-input').value
         if (d_mod == 1.0) {
             volMaterial.uniforms["u_density"].value = densityTexture;
             // volMaterial.uniforms[ " u_grayscaleDepthMod" ]
             // //console.log(densityMin,densityMax)
             volMaterial.uniforms["u_climDensity"].value.set(densityMin, densityMax);
         } else {
             volMaterial.uniforms["u_density"].value = blankTexture;
             volMaterial.uniforms["u_climDensity"].value.set(1.0, 1.0);
             // d = []
         }
         volMaterial.uniforms["u_densityDepthMod"].value = d_mod;
         volMaterial.uniforms["u_densityModI"].value = (document.getElementById("density-mod-intensity")).value
         volMaterial.uniforms["u_densityMod"].value = 1.0;
         // if((document.getElementById("density-mod-check")).checked){
         //     
         // }
         // else{
         //     volMaterial.uniforms[ "u_densityMod" ].value = 0.0;
         // }
 
 
         // if((document.getElementById("dist-mod-check")).checked){
         //     volMaterial.uniforms[ "u_distMod" ].value = 1.0;
         // }
         // else{
         //     volMaterial.uniforms[ "u_distMod" ].value = 0.0;
         // }
 
         if ((document.getElementById("val-mod-check")).checked) {
             volMaterial.uniforms["u_valMod"].value = 1.0;
         } else {
             volMaterial.uniforms["u_valMod"].value = 0.0;
         }
 
         //store values in local storage cache
         localStorage.setItem('gasMinVal', (document.getElementById('gas-minval-input')).value);
         localStorage.setItem('gasMaxVal', (document.getElementById('gas-maxval-input')).value);
 
         localStorage.setItem('dmMinVal', (document.getElementById('dm-minval-input')).value);
         localStorage.setItem('dmMaxVal', (document.getElementById('dm-maxval-input')).value);
 
         //check if "min/max" checks are enabled to disable the number input
         document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
         document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);
 
         if (document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked) {
             volMaterial.uniforms["u_gasClim"].value.set(climGasLimits[0], climGasLimits[1]);
         } else if (document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked) {
             volMaterial.uniforms["u_gasClim"].value.set(climGasLimits[0], document.querySelector('#gas-maxval-input').value);
         } else if (!document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked) {
             volMaterial.uniforms["u_gasClim"].value.set(document.querySelector('#gas-minval-input').value, climGasLimits[1]);
         } else if (!document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked) {
             volMaterial.uniforms["u_gasClim"].value.set(document.querySelector('#gas-minval-input').value, document.querySelector('#gas-maxval-input').value);
         } else {
 
         }
 
         volMaterial.uniforms["u_gasClip"].value = [document.getElementById("gas-min-clip-check").checked, document.getElementById("gas-max-clip-check").checked]
 
         gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
         gasMidCol = new THREE.Color(document.querySelector("#gasMidCol").value);
         gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
 
         gasMinA = parseFloat(document.querySelector("#gasMinA").value);
         gasMidA = parseFloat(document.querySelector("#gasMidA").value);
         gasMaxA = parseFloat(document.querySelector("#gasMaxA").value);
 
         gasColData = new Uint8Array(4 * 256)
 
         w = 256
         h = 1
         size = w * h
 
         function alphaLerp(start, end, t) {
             return start * (1 - t) + end * t
         }
 
         for (i = 0; i < w; i++) {
             stride = i * 4
             let a = i / w
             if (i < w / 2) {
                 c = gasMinCol.clone().lerp(gasMidCol, a)
                 alpha = alphaLerp(gasMinA, gasMidA, a)
 
             } else {
                 c = gasMidCol.clone().lerp(gasMaxCol, a)
                 alpha = alphaLerp(gasMidA, gasMaxA, a)
             }
             gasColData[stride] = Math.floor(c.r * 255)
             gasColData[stride + 1] = Math.floor(c.g * 255)
             gasColData[stride + 2] = Math.floor(c.b * 255)
             gasColData[stride + 3] = Math.floor(alpha * 255)
         }
         cmtexture['PartType0'] = new THREE.DataTexture(gasColData, w, h, THREE.RGBAFormat)
         gasColData = []
         volMaterial.uniforms["u_cmGasData"].value = cmtexture['PartType0'];
 
         //dm data
 
         document.getElementById("dm-minval-input").disabled = (document.getElementById("dm-min-check").checked);
         document.getElementById("dm-maxval-input").disabled = (document.getElementById("dm-max-check").checked);
 
         if (document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked) {
             volMaterial.uniforms["u_dmClim"].value.set(climDMLimits[0], climDMLimits[1]);
         } else if (document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked) {
             volMaterial.uniforms["u_dmClim"].value.set(climDMLimits[0], document.querySelector('#dm-maxval-input').value);
         } else if (!document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked) {
             volMaterial.uniforms["u_dmClim"].value.set(document.querySelector('#dm-minval-input').value, climDMLimits[1]);
         } else if (!document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked) {
             volMaterial.uniforms["u_dmClim"].value.set(document.querySelector('#dm-minval-input').value, document.querySelector('#dm-maxval-input').value);
         } else {
 
         }
         // //console.log(volMaterial.uniforms["u_dmClim"].value)
         volMaterial.uniforms["u_dmClip"].value = [document.getElementById("dm-min-clip-check").checked, document.getElementById("dm-max-clip-check").checked]
 
         dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
         dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
 
         dmMinA = parseFloat(document.querySelector("#dmMinA").value);
         dmMaxA = parseFloat(document.querySelector("#dmMaxA").value);
 
 
         dmColData = new Uint8Array(4 * 256)
 
         w = 256
         h = 1
         size = w * h
         for (i = 0; i < w; i++) {
             stride = i * 4
             let a = i / w
             c = dmMinCol.clone().lerp(dmMaxCol.clone(), a)
             alpha = alphaLerp(dmMinA, dmMaxA, a)
             dmColData[stride] = Math.floor(c.r * 255)
             dmColData[stride + 1] = Math.floor(c.g * 255)
             dmColData[stride + 2] = Math.floor(c.b * 255)
             dmColData[stride + 3] = Math.floor(alpha * 255)
         }
         cmtexture['PartType1'] = new THREE.DataTexture(dmColData, w, h, THREE.RGBAFormat)
         dmColData = []
         volMaterial.uniforms["u_cmDMData"].value = cmtexture['PartType1'];
         volMaterial.needsUpdate = true
     }
     render()
 
 }
 
 function updateSkewerWidths() {
     updateSkewerEndpoints(gridsize)
     // for (i = 0; i < lines.length; i++) {
     //     const mat = lines[i].material
     //     skewerScene.remove(lines[i])
     // }
 }
 
 function updateSkewerBrightness() {
     volMaterial.uniforms["u_skewerBrightness"].value = document.getElementById("skewer-brightness-slider").value
     volMaterial.uniformsNeedUpdate = true
 }
 
 function init3dDataTexture(size) {
     // startLoadingAnimation()
     //console.log('initialize 3d data texture')
     return new Promise(resolve => {
         clearLayer(0)
 
         dataArray3D = new Float32Array(size * size * size * 3) //Float32Array(size * size * size * 3)
 
         dataTexture3D = new THREE.DataTexture3D(dataArray3D, size, size, size)
         dataTexture3D.internalformat = 'RGB32F' //'RGB8UI' //
         dataTexture3D.format = THREE.RGBFormat //RGBFormat//RGBIntegerFormat
         dataTexture3D.type = THREE.FloatType ////UnsignedByteType 
         dataTexture3D.minFilter = THREE.LinearFilter //LinearMipmapLinearFilter
         dataTexture3D.magFilter = THREE.LinearFilter
         dataTexture3D.unpackAlignment = 4
         dataTexture3D.encoding = THREE.sRGBEncoding
         dataTexture3D.anisotropy = 16
         dataTexture3D.needsUpdate = true
         volumeShader = THREE.VolumeRenderShader1;
         volumeUniforms = THREE.UniformsUtils.clone(volumeShader.uniforms);
         volumeUniforms["u_dataTexture3D"].value = dataTexture3D;
         volumeUniforms["u_gasClip"].value = [true, true]
         volumeUniforms["u_dmClip"].value = [true, true]
         volMaterial = new THREE.ShaderMaterial({
             uniforms: volumeUniforms,
             vertexShader: volumeShader.vertexShader,
             fragmentShader: volumeShader.fragmentShader,
             clipping: false,
             side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
             transparent: true,
             // opacity: 0.05,
             // blending: THREE.CustomBlending,
             blendEquation: THREE.AddEquation,
             blendSrc: THREE.OneFactor,
             blendDst: THREE.OneMinusSrcAlphaFactor,
             depthWrite: false,
         });
         volMaterial.extensions.derivatives = true
         volMaterial.glslVersion = THREE.GLSL3
 
         // stopLoadingAnimation()
         resolve()
     })
 }
 
 function update3dDataTexture() {
     return new Promise(resolve => {
         // startLoadingAnimation()
         //console.log("update 3d texture uniforms")
         dataTexture3D = new THREE.DataTexture3D(dataArray3D, gridsize, gridsize, gridsize)
         dataTexture3D.internalformat = 'RGB32F' // 'RGB8UI'
         dataTexture3D.format = THREE.RGBFormat
         dataTexture3D.type = THREE.FloatType // UnsignedByteType // 
         dataTexture3D.minFilter = dataTexture3D.magFilter = THREE.LinearFilter //THREE.NearestFilter//
         dataTexture3D.unpackAlignment = 4
         dataTexture3D.needsUpdate = true
         // uniforms[ "u_gasData" ].value = gasTexture;
         // uniforms[ "u_dmData" ].value = dmTexture;
         volMaterial.uniforms["u_dataTexture3D"].value = dataTexture3D;
         volMaterial.uniforms["u_size"].value.set(gridsize, gridsize, gridsize);
         volMaterial.uniforms["u_gasClim"].value.set(climGasLimits[0], climGasLimits[1]);
         volMaterial.uniforms["u_dmClim"].value.set(climDMLimits[0], climDMLimits[1]);
         volMaterial.uniforms["u_renderstyle"].value = 'mip' == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
         volMaterial.uniforms["u_renderthreshold"].value = 1.0; // For ISO renderstyle
         volMaterial.uniforms["u_cmGasData"].value = cmtexture['PartType0'];
         volMaterial.uniforms["u_cmDMData"].value = cmtexture['PartType1'];
         volMaterial.extensions.drawBuffers = true
         volMaterial.extensions.fragDepth = true
         volMaterial.extensions.shaderTextureLOD = true
         volMaterial.needsUpdate = true
         volGeometry = new THREE.BoxBufferGeometry(gridsize, gridsize, gridsize);
         volGeometry.translate(gridsize / 2, gridsize / 2, gridsize / 2);
 
         // if(oldPos && oldSize){
         //     camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
         //     // camera.lookAt(gridsize/2,  gridsize/2,  gridsize/2)
         //     // camera.zoom = 6
         //     camera.updateProjectionMatrix()
         //     controls.target.set( gridsize/2,  gridsize/2,  gridsize/2 );
         // }
         var mesh = new THREE.Mesh(volGeometry, volMaterial);
         mesh.layers.set(0)
         mesh.renderOrder = 2
         volMesh = mesh
         updateUniforms()
         scene.add(mesh);
         // stopLoadingAnimation()
         render()
         resolve()
     })
 }
 
 function loadGas(size, attr, resolution_bool) {
     // startLoadingAnimation()
     gasAttr = attr
     //console.log('loading gas')
     return new Promise(resolve => {
         d3.json('static/data/' + simID + '/PartType0/' + size + '_PartType0_' + attr + '.json').then(function (d) {
             // d3.text('static/data/'+simID+'/PartType0/' + size + '_PartType0_' + attr +'.json').then(function(textData){
             //     textData = textData.replace(/-Infinity/g, '"-Infinity"');
             //     const d = JSON.parse(textData, function(key, value){
             //         return value === "-Infinity" ? -Infinity : value;
             //     });
 
             volMaterial.uniforms["u_gasAttribute"] = attr
 
             let log = false
             // if(size == 64){
 
             //     if(elements.includes(attr) || attr=="GFM_Metallicity"){
             //         log = false
             //         if(attr=="Temperature" ){
             //             min = 3.745
             //             max = 6.5
             //         }
             //     }
             //     else{
             //         log = true
             //     }
             // }
             // else{
             //     log = false
             // }
             //GAS IS THE RED CHANNEL IN THE 3D DATA TEXTURE
             var min = Infinity
             var max = -Infinity
             // console.log(log)
             for (x = 0; x < size; x++) {
                 for (y = 0; y < size; y++) {
                     for (z = 0; z < size; z++) {
                         if (simID == "TNG100" && attr == "GFM_Metallicity") {
                             dataArray3D[3 * (x + y * size + z * size * size)] = d[x][y][z]
                         }
                         // else if(attr=="Metallicity"){
                         //     dataArray3D[ 3 * ( x + y * size + z * size * size ) ] =  Math.log10(d[x][y][z]*77.22015)
                         // }
                         else if (log) {
                             dataArray3D[3 * (x + y * size + z * size * size)] = Math.log10(d[x][y][z])
                         } else {
                             dataArray3D[3 * (x + y * size + z * size * size)] = d[x][y][z]
                         }
 
                         if (dataArray3D[3 * (x + y * size + z * size * size)] < min) {
                             min = dataArray3D[3 * (x + y * size + z * size * size)]
                         }
                         if (dataArray3D[3 * (x + y * size + z * size * size)] > max) {
                             max = dataArray3D[3 * (x + y * size + z * size * size)]
                         }
 
                     }
                 }
             }
             if (min == -Infinity) { min = -323 } // -323 is the smallest value log10() can return in javascript... because log10(0)=-Infinity
             var x = document.getElementById("gas-eye-open");
             x.style.display = "inline-block";
             var y = document.getElementById("gas-eye-closed");
             y.style.display = "none";
 
             let minval = document.getElementById('gas-minval-input')
             minval.value = round(min, 2)
             let maxval = document.getElementById('gas-maxval-input')
             maxval.value = round(max, 2)
             gasUnpackDomain = []
             if (resolution_bool) {
                 if (localStorage.getItem('gasMinVal') != "") {
                     min = localStorage.getItem('gasMinVal')
                     minval.value = min
                 }
                 if (localStorage.getItem('gasMaxVal') != "") {
                     max = localStorage.getItem('gasMaxVal')
                     maxval.value = max
                 }
             }
             if (simID.substr(0, 3) != 'TNG') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = 2.0
                     minval.value = 4
                     max = 7.5
                     maxval.value = 7
                     gasUnpackDomain = [1.0, 8.0]
                 }
                 if (attr == "Density") {
                     min = -33.0
                     minval.value = -31.0
                     max = -27.0
                     maxval.value = -24.0
                     gasUnpackDomain = [-33.0, -23.0]
                 }
                 if (attr == "Entropy") {
                     min = 1.0
                     minval.value = 1.0
                     max = 6.0
                     maxval.value = 6.0
                     gasUnpackDomain = [0.0, 6.0]
                 }
                 if (attr == "Metallicity") {
                     min = -5.0
                     minval.value = -5.0
                     max = 1.0
                     maxval.value = 0
                     gasUnpackDomain = [-5.0, 1.0]
                 }
                 if (attr == "pressure") {
                     min = -4.0
                     minval.value = -1.0
                     max = 7.0
                     maxval.value = 3.0
                     gasUnpackDomain = [-4.0, 7.0]
                 }
                 if (attr == "Machnumber") {
                     min = -3.0
                     minval.value = -1.0
                     max = 3.0
                     maxval.value = 3.0
                     gasUnpackDomain = [-3.0, 4.0]
                 }
                 if (attr == "tcool_tff") {
                     min = -3.0
                     minval.value = -2.0
                     max = 4.0
                     maxval.value = 2.0
                     gasUnpackDomain = [-3.0, 4.0]
                 }
                 if (attr == "xray_luminosity_0.1_2_keV") {
                     min = 26.0
                     minval.value = 30.0
                     max = 44.0
                     maxval.value = 40.0
                     gasUnpackDomain = [24.0, 44.0]
                 }
                 if (attr == "Carbon") {
                     min = 0.0
                     minval.value = 0.0001
                     max = 0.01
                     maxval.value = 0.001
                     gasUnpackDomain = [0.0, 0.01]
                 }
                 if (attr == "Oxygen") {
                     min = 0.0
                     minval.value = 0.0001
                     max = 0.01
                     maxval.value = 0.001
                     gasUnpackDomain = [0.0, 0.01]
                 }
 
             } else if (simID == 'TNG100_z0.0') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = Math.log10(1433.90826193)
                     minval.value = 3.745
                     max = Math.log10(7.6024808e8)
                     maxval.value = 6.75
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Density") {
                     min = Math.log10(3.22215222e-31)
                     minval.value = -31.0
                     max = -27.0
                     maxval.value = -20.0
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Metallicity") {
                     min = -3.0 //Math.log10(4.06559314e-10)
                     minval.value = -3.0 //Math.log10(4.06559314e-10)
                     max = 1.0 //Math.log10(0.16250114)
                     maxval.value = -1.0 //Math.log10(0.16250114)
                     gasUnpackDomain = [min, max]
                 }
                 // if (attr == "Masses") {
                 //     min = Math.log10(3.11659301e-06)
                 //     minval.value = Math.log10(3.11659301e-06)
                 //     max = Math.log10(0.00150664)
                 //     maxval.value = Math.log10(0.00150664)
                 //     gasUnpackDomain = [min, max]
                 // }
                 if (attr == "Entropy") {
                     min = 1.0
                     minval.value = 1.0
                     max = 6.0
                     maxval.value = 6.0
                     gasUnpackDomain = [0.0, 6.0]
                 }
                 if (attr == "pressure") {
                     min = -4.0
                     minval.value = -1.0
                     max = 7.0
                     maxval.value = 3.0
                     gasUnpackDomain = [-4.0, 7.0]
                 }
                 if (attr == "Machnumber") {
                     min = -3.0
                     minval.value = -1.0
                     max = 3.0
                     maxval.value = 3.0
                     gasUnpackDomain = [-3.0, 4.0]
                 }
                 if (attr == "tcool_tff") {
                     min = -3.0
                     minval.value = -2.0
                     max = 4.0
                     maxval.value = 2.0
                     gasUnpackDomain = [-3.0, 4.0]
                 }
                 if (attr == "xray_luminosity_0.1_2_keV") {
                     min = 26.0
                     minval.value = 30.0
                     max = 44.0
                     maxval.value = 40.0
                     gasUnpackDomain = [24.0, 44.0]
                 }
             } else if (simID == 'TNG100_z2.3') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = Math.log10(1433.90826193)
                     minval.value = 3.745
                     max = Math.log10(7.6024808e8)
                     maxval.value = 6.75
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Density") {
                     min = Math.log10(3.22215222e-31)
                     minval.value = Math.log10(3.22215222e-31)
                     max = Math.log10(4.31157793e-19)
                     maxval.value = Math.log10(4.31157793e-19)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Metallicity") {
                     min = -3.0 //Math.log10(4.06559314e-10)
                     minval.value = -3.0 //Math.log10(4.06559314e-10)
                     max = 1.0 //Math.log10(0.16250114)
                     maxval.value = -1.0 //Math.log10(0.16250114)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Masses") {
                     min = Math.log10(3.11659301e-06)
                     minval.value = Math.log10(3.11659301e-06)
                     max = Math.log10(0.00150664)
                     maxval.value = Math.log10(0.00150664)
                     gasUnpackDomain = [min, max]
                 }
             }
             climGasLimits = [min, max]
 
 
 
 
 
             volMaterial.uniforms["u_gasUnpackDomain"].value.set(gasUnpackDomain[0], gasUnpackDomain[1])
             // if(elements.includes(attr)){
 
 
             // min = 4.5
             // minval.value = 4.5
             // }
             let gasUnits = document.getElementsByClassName('gas-attr-units')
             for (i = 0; i < gasUnits.length; i++) {
                 if ((attr == 'Temperature') || (attr == 'Temperature_Test') || (attr == 'Temperature_Test1')) {
                     gasUnits[i].innerHTML = 'log(K)'
                 } else if (elements.includes(attr)) {
                     gasUnits[i].innerHTML = 'unitless'
                 } else if (attr == "Mass") {
                     gasUnits[i].innerHTML = 'log(Msun)'
                 } else if (attr == "Density") {
                     gasUnits[i].innerHTML = 'log(g/cm<sup>3</sup>)'
                 } else if (attr == "InternalEnergy") {
                     gasUnits[i].innerHTML = "log(erg/g)"
                 } else if (attr == "pressure") {
                     gasUnits[i].innerHTML = "log(K/cm<sup>3)"
                 } else if (attr == "xray_luminosity_0.1_2_keV") {
                     gasUnits[i].innerHTML = "log(erg/s)"
                 } else if (attr == "Entropy") {
                     gasUnits[i].innerHTML = "log(cm<sup>2</sup>keV)"
                 } else if (attr == "Metallicity") {
                     gasUnits[i].innerHTML = "log(Zsun)"
                 } else {
                     gasUnits[i].innerHTML = 'dimensionless'
                 }
             }
             initColor('PartType0')
             // updateUniforms()
             // update3dDataTexture()
             // stopLoadingAnimation()
             resolve()
         })
     })
 }
 
 function loadDarkMatter(size) {
     //console.log('loading dark matter')
     // startLoadingAnimation()
     attr = 'density'
     return new Promise(resolve => {
         try {
             d3.json('static/data/' + simID + '/PartType1/' + size + '_PartType1_' + attr + '.json').then(function (d) {
                 // d3.text('static/data/'+simID+'/PartType1/' + size + '_PartType1_' + attr +'.json').then(function(textData){
                 //     textData = textData.replace(/-Infinity/g, '"-Infinity"');
                 //     const d = JSON.parse(textData, function(key, value){
                 //         return value === "-Infinity" ? -Infinity : value;
                 //     });
                 // //console.log(d)
                 // DM_file_exists = true
                 log = false
 
                 // DARK MATTER IS THE GREEN CHANNEL IN THE 3D DATA TEXTURE
 
                 min = Infinity
                 max = -Infinity
                 for (x = 0; x < size; x++) {
                     for (y = 0; y < size; y++) {
                         for (z = 0; z < size; z++) {
                             if (log) {
                                 dataArray3D[3 * (x + y * size + z * size * size) + 1] = Math.log10(d[x][y][z])
                             } else {
                                 dataArray3D[3 * (x + y * size + z * size * size) + 1] = d[x][y][z]
                             }
 
                             if (dataArray3D[3 * (x + y * size + z * size * size) + 1] < min) {
                                 min = dataArray3D[3 * (x + y * size + z * size * size) + 1]
                             }
 
                             if (dataArray3D[3 * (x + y * size + z * size * size) + 1] > max) {
                                 max = dataArray3D[3 * (x + y * size + z * size * size) + 1]
                             }
                         }
                     }
                 }
 
                 if (min == -Infinity) { min = -323 } // -323 is the smallest value log10() can return in javascript... because log10(0)=-Infinity
                 // var x = document.getElementById("dm-eye-open");
                 // x.style.display = "inline-block";
 
                 // var y = document.getElementById("dm-eye-closed");
                 // y.style.display = "none";
                 // // volMaterial.uniforms["u_dmVisibility"].value = true
                 // volMaterial.uniforms["u_dmVisibility"].value = false
 
                 var x = document.getElementById("dm-eye-open");
                 x.style.display = "none";
                 var y = document.getElementById("dm-eye-closed");
                 y.style.display = "inline-block";
                 volMaterial.uniforms["u_dmVisibility"].value = false
 
                 // if(localStorage.getItem('dmMinVal') != ""){
                 //     min = localStorage.getItem('dmMinVal')
                 // }
                 // if(localStorage.getItem('dmMaxVal') != ""){
                 //     max = localStorage.getItem('dmMaxVal')
                 // }
                 // climDMLimits = [min, max]
                 if (simID == 'RefL0012N0188') {
                     gridrestomaxval = {
                         64: 1.26664915e-26,
                         128: 6.9301215e-26,
                         256: 2.1937904e-25,
                         512: 6.3844367e-25
                     }
                     darkmatterUnpackDomain = [0.0, gridrestomaxval[size]]
                     climDMLimits = [0.0, gridrestomaxval[size]]
 
                     let minval = document.getElementById('dm-minval-input')
                     minval.value = 0.0 //round(min,2)
                     let maxval = document.getElementById('dm-maxval-input')
                     maxval.value = gridrestomaxval[size] //round(max,2)
                 }
                 if (simID == 'RefL0025N0376') {
                     gridrestomaxval = {
                         64: 7.00784199967097e-27,
                         128: 2.4839307056953186e-26,
                         256: 8.163568369617648e-26,
                         512: 2.2696208635739263e-25
                     }
                     darkmatterUnpackDomain = [0.0, gridrestomaxval[size]]
                     climDMLimits = [0.0, gridrestomaxval[size]]
 
                     let minval = document.getElementById('dm-minval-input')
                     minval.value = 0.0 //round(min,2)
                     let maxval = document.getElementById('dm-maxval-input')
                     maxval.value = gridrestomaxval[size] //round(max,2)
                 }
 
                 if (simID == "TNG100_z2.3") {
                     darkmatterUnpackDomain = [1.75, 5.0]
                     climDMLimits = [1.75, 5.0]
 
                     let minval = document.getElementById('dm-minval-input')
                     minval.value = 1.75 //round(min,2)
                     let maxval = document.getElementById('dm-maxval-input')
                     maxval.value = 5.0 //round(max,2)
                 }
 
                 if (simID == "RefL0100N1504") {
                     darkmatterUnpackDomain = [-1.0, 3.5]
                     climDMLimits = [-1.0, 3.5]
 
                     let minval = document.getElementById('dm-minval-input')
                     minval.value = -1.0 //round(min,2)
                     let maxval = document.getElementById('dm-maxval-input')
                     maxval.value = 3.5 //round(max,2)
                 }
 
                 // min = -28
                 // minval.value = -28
                 // max = -25
                 // maxval.value = -25 
                 let dmUnits = document.getElementsByClassName('dm-attr-units')
                 for (i = 0; i < dmUnits.length; i++) {
                     if (simID == "RefL0100N1504") {
                         dmUnits[i].innerHTML = 'log10(Msun/kpc<sup>3</sup>)'
                     }
                     if (simID == "TNG100_z2.3") {
                         dmUnits[i].innerHTML = 'log10(Msun/kpc<sup>3</sup>)'
                     } else {
                         dmUnits[i].innerHTML = 'g/cm<sup>3</sup>' //'log(g/cm<sup>3</sup>)'
                     }
                 }
 
                 volMaterial.uniforms["u_darkmatterUnpackDomain"].value.set(darkmatterUnpackDomain[0], darkmatterUnpackDomain[1])
                 volMaterial.uniforms["u_dmVisibility"].value = false
                 volMaterial.needsUpdate = true
 
                 initColor('PartType1')
                 // updateUniforms()
                 // update3dDataTexture()
                 // stopLoadingAnimation()
                 resolve()
             })
         } catch (err) {
 
 
             resolve()
         }
         resolve()
     })
 }
 
 // FH - zoom in functions:
 
 // function loadZoomIn(size, attr, resolution_bool, haloID) {
 function loadZoomGas(size, attr, resolution_bool, haloID) {
 
     // console.log('in the zoom-in function')
 
     // function loadGasZoom(size, attr, resolution_bool, haloID) {
     // startLoadingAnimation()
     gasAttr = attr
     // str2 = 'static/data/' + simID + '/Halos/halo_' + haloID + '/PartType0/' + size + '_PartType0_' + attr + '.json'
     console.log('loading zoom-in gas', haloID, size)
 
     return new Promise(resolve => {
         d3.json('static/data/' + simID + '/Halos/halo_' + haloID + '/PartType0/' + size + '_PartType0_' + attr + '.json').then(function (d) {
             volMaterial.uniforms["u_gasAttribute"] = attr
 
             let log = false
 
             //GAS IS THE RED CHANNEL IN THE 3D DATA TEXTURE
             var min = Infinity
             var max = -Infinity
             // console.log(log)
             for (x = 0; x < size; x++) {
                 for (y = 0; y < size; y++) {
                     for (z = 0; z < size; z++) {
                         if (simID == "TNG100" && attr == "GFM_Metallicity") {
                             dataArray3D[3 * (x + y * size + z * size * size)] = d[x][y][z]
                         }
                         else if (log) {
                             dataArray3D[3 * (x + y * size + z * size * size)] = Math.log10(d[x][y][z])
                         } else {
                             dataArray3D[3 * (x + y * size + z * size * size)] = d[x][y][z]
                         }
 
                         if (dataArray3D[3 * (x + y * size + z * size * size)] < min) {
                             min = dataArray3D[3 * (x + y * size + z * size * size)]
                         }
                         if (dataArray3D[3 * (x + y * size + z * size * size)] > max) {
                             max = dataArray3D[3 * (x + y * size + z * size * size)]
                         }
 
                     }
                 }
             }
             if (min == -Infinity) { min = -323 } // -323 is the smallest value log10() can return in javascript... because log10(0)=-Infinity
             var x = document.getElementById("gas-eye-open");
             x.style.display = "inline-block";
             var y = document.getElementById("gas-eye-closed");
             y.style.display = "none";
 
             let minval = document.getElementById('gas-minval-input')
             minval.value = round(min, 2)
             let maxval = document.getElementById('gas-maxval-input')
             maxval.value = round(max, 2)
             gasUnpackDomain = []
             if (resolution_bool) {
                 if (localStorage.getItem('gasMinVal') != "") {
                     min = localStorage.getItem('gasMinVal')
                     minval.value = min
                 }
                 if (localStorage.getItem('gasMaxVal') != "") {
                     max = localStorage.getItem('gasMaxVal')
                     maxval.value = max
                 }
             }
             if (simID.substr(0, 3) != 'TNG') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = 2.0
                     minval.value = 5.5
                     max = 7.5
                     maxval.value = 7
                     gasUnpackDomain = [1.0, 8.0]
                 }
                 if (attr == "Carbon") {
                     min = 0.0
                     minval.value = 0.0001
                     max = 0.01
                     maxval.value = 0.001
                     gasUnpackDomain = [0.0, 0.01]
                 }
                 if (attr == "Density") {
                     min = -33.0
                     minval.value = -31
                     max = -25.0
                     maxval.value = -24
                     gasUnpackDomain = [-33.0, -23.0]
                 }
                 if (attr == "Entropy") {
                     min = 1.0
                     minval.value = 1.0
                     max = 6.0
                     maxval.value = 6.0
                     gasUnpackDomain = [0.0, 6.0]
                 }
                 if (attr == "xray_luminosity_0.1_2_keV") {
                     min = 26.0
                     minval.value = 32.0
                     max = 44.0
                     maxval.value = 42.0
                     gasUnpackDomain = [24.0, 44.0]
                 }
                 if (attr == "Metallicity") {
                     min = -5.0
                     minval.value = -5.0
                     max = 1.0
                     maxval.value = 0
                     gasUnpackDomain = [-5.0, 1.0]
                 }
                 if (attr == "Oxygen") {
                     min = 0.0
                     minval.value = 0.0001
                     max = 0.01
                     maxval.value = 0.001
                     gasUnpackDomain = [0.0, 0.01]
                 }
 
             } else if (simID == 'TNG100_z0.0') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = Math.log10(1433.90826193)
                     minval.value = 3.745
                     max = Math.log10(7.6024808e8)
                     maxval.value = 6.75
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Density") {
                     min = Math.log10(3.22215222e-31)
                     minval.value = Math.log10(3.22215222e-31)
                     max = Math.log10(4.31157793e-19)
                     maxval.value = Math.log10(4.31157793e-19)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Metallicity") {
                     min = -3.0 //Math.log10(4.06559314e-10)
                     minval.value = -3.0 //Math.log10(4.06559314e-10)
                     max = 1.0 //Math.log10(0.16250114)
                     maxval.value = -1.0 //Math.log10(0.16250114)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Masses") {
                     min = Math.log10(3.11659301e-06)
                     minval.value = Math.log10(3.11659301e-06)
                     max = Math.log10(0.00150664)
                     maxval.value = Math.log10(0.00150664)
                     gasUnpackDomain = [min, max]
                 }
             } else if (simID == 'TNG100_z2.3') {
                 // set some default values
                 if (attr == "Temperature") {
                     let dropdown = document.getElementById("gas_select")
                     dropdown.value = 'Temperature'
                     min = Math.log10(1433.90826193)
                     minval.value = 3.745
                     max = Math.log10(7.6024808e8)
                     maxval.value = 6.75
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Density") {
                     min = Math.log10(3.22215222e-31)
                     minval.value = Math.log10(3.22215222e-31)
                     max = Math.log10(4.31157793e-19)
                     maxval.value = Math.log10(4.31157793e-19)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Metallicity") {
                     min = -3.0 //Math.log10(4.06559314e-10)
                     minval.value = -3.0 //Math.log10(4.06559314e-10)
                     max = 1.0 //Math.log10(0.16250114)
                     maxval.value = -1.0 //Math.log10(0.16250114)
                     gasUnpackDomain = [min, max]
                 }
                 if (attr == "Masses") {
                     min = Math.log10(3.11659301e-06)
                     minval.value = Math.log10(3.11659301e-06)
                     max = Math.log10(0.00150664)
                     maxval.value = Math.log10(0.00150664)
                     gasUnpackDomain = [min, max]
                 }
             }
             climGasLimits = [min, max]
 
             volMaterial.uniforms["u_gasUnpackDomain"].value.set(gasUnpackDomain[0], gasUnpackDomain[1])
 
             let gasUnits = document.getElementsByClassName('gas-attr-units')
             for (i = 0; i < gasUnits.length; i++) {
                 if ((attr == 'Temperature') || (attr == 'Temperature_Test') || (attr == 'Temperature_Test1')) {
                     gasUnits[i].innerHTML = 'log(K)'
                 } else if (elements.includes(attr)) {
                     gasUnits[i].innerHTML = 'unitless'
                 } else if (attr == "Mass") {
                     gasUnits[i].innerHTML = 'log(Msun)'
                 } else if (attr == "Density") {
                     gasUnits[i].innerHTML = 'log(g/cm<sup>3</sup>)'
                 } else if (attr == "xray_luminosity_0.1_2_keV") {
                     gasUnits[i].innerHTML = "log(erg/s)"
                 } else if (attr == "InternalEnergy") {
                     gasUnits[i].innerHTML = "log(erg/g)"
                 } else if (attr == "Entropy") {
                     gasUnits[i].innerHTML = "log(cm<sup>2</sup>keV)"
                 } else if (attr == "Metallicity") {
                     gasUnits[i].innerHTML = "log(Zsun)"
                 } else {
                     gasUnits[i].innerHTML = 'dimensionless'
                 }
             }
             initColor('PartType0')
             updateUniforms()
             update3dDataTexture()
             // stopLoadingAnimation()
             resolve()
         })
     })
     // }
 
 
 }
 
 function loadZoomStars(haloID) {
     // startLoadingAnimation()
     console.log('loading zoom-in stars', haloID)
     return new Promise(resolve => {
         while (starScene.children.length > 0) {
             starScene.remove(starScene.children[0]);
         }
 
         var galCenter = []
         var galSpin = []
 
         d3.json('static/data/' + simID + '/Halos/halo_' + haloID + '/simMetadata.json').then(function (d) {
             zoomEdges.left_edge = d.left_edge
             zoomEdges.right_edge = d.right_edge
 
             galCenter = d.star_center
             galSpin = d.star_spin
 
             // console.log(edges,zoomEdges)
             resolve()
         })
 
 
 
         d3.json('static/data/' + simID + '/Halos/halo_' + haloID + '/PartType4/star_particles.json').then(function (d) {
             // console.log( Object.keys(d).length )
             starData = []
             n = Object.keys(d).length
             console.log(zoomEdges, n)
 
             // console.log('hey',edges,zoomEdges,galCenter,galSpin)
 
             // console.log(n,edges.left_edge,edges.right_edge)
 
             var starGeometry = new THREE.BufferGeometry();
             var starPositions = new Float32Array(n * 3)
             if (Object.keys(d).length > 0) {
                 for (i = 0; i < n; i++) {
                     mx = gridsize * ((d[i][0] - zoomEdges.left_edge[0]) / (zoomEdges.right_edge[0] - zoomEdges.left_edge[0]))
                     my = gridsize * ((d[i][1] - zoomEdges.left_edge[1]) / (zoomEdges.right_edge[1] - zoomEdges.left_edge[1]))
                     mz = gridsize * ((d[i][2] - zoomEdges.left_edge[2]) / (zoomEdges.right_edge[2] - zoomEdges.left_edge[2]))
                     let vertex = new THREE.Vector3(mx, my, mz)
                     vertex.toArray(starPositions, i * 3)
                     starData[i] = [d[i][0], //x
                     d[i][1], //y
                     d[i][2], //z
                     d[i][3], //subhalo ID
                     d[i][4] //solar mass
                     ]
 
                 }
                 // console.log('star positions:')
                 // console.log(starPositions)
                 starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)) //.onUpload( disposeArray )
                 starGeometry.computeBoundingBox()
                 // console.log('star positions', starGeometry)
                 boxOfStarPoints = new THREE.Points(starGeometry, starMaterial);
                 boxOfStarPoints.layers.enable(3)
                 boxOfStarPoints.layers.set(3)
                 boxOfStarPoints.renderOrder = 0
                 starScene.add(boxOfStarPoints);
                 var x = document.getElementById("star-eye-open");
                 x.style.display = "inline-block";
                 var y = document.getElementById("star-eye-closed");
                 y.style.display = "none";
                 // renderer.setRenderTarget( target )
                 // renderer.render( starScene, camera );
                 // renderer.setRenderTarget( null )
 
                 //////// Some ideas below - SPIN ARROW:
 
                 // let material = new THREE.LineBasicMaterial({
                 //     color: 0xffffff })
 
                 // var points = [];
                 // points.push( new THREE.Vector3( 0, 0, 0 ) );
                 // points.push( new THREE.Vector3( 0, 100, 0 ) );
                 // points.push( new THREE.Vector3( 100, 0, 0 ) );
 
                 // var geometry = new THREE.BufferGeometry().setFromPoints( points );
 
                 // var line = new THREE.Line( geometry, material );
                 // starScene.add( line );
 
                 // const dir = new THREE.Vector3( 10, 20, 5 );
 
                 // //normalize the direction vector (convert to vector of length 1)
                 // // dir.normalize();
 
                 // const origin = new THREE.Vector3( 0,0,0 );
                 // const length = 1;
                 // const hex = 0xffffff;
 
                 // const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
                 // starScene.add( arrowHelper );
 
 
                 //center of most massive galaxy scaled to voxelized grid:           
                 galX = gridsize * ((galCenter[0] - zoomEdges.left_edge[0]) / (zoomEdges.right_edge[0] - zoomEdges.left_edge[0]))
                 galY = gridsize * ((galCenter[1] - zoomEdges.left_edge[1]) / (zoomEdges.right_edge[1] - zoomEdges.left_edge[1]))
                 galZ = gridsize * ((galCenter[2] - zoomEdges.left_edge[2]) / (zoomEdges.right_edge[2] - zoomEdges.left_edge[2]))
 
                 // galX = (galCenter[0])
                 // galY = (galCenter[1])
                 // galZ = (galCenter[2])
 
                 //spin of most massive galaxy scaled to voxelized grid:
                 // spinX = ((galSpin[0] - zoomEdges.left_edge[0]) / (zoomEdges.right_edge[0] - zoomEdges.left_edge[0]))
                 // spinY = ((galSpin[1] - zoomEdges.left_edge[1]) / (zoomEdges.right_edge[1] - zoomEdges.left_edge[1]))
                 // spinZ = ((galSpin[2] - zoomEdges.left_edge[2]) / (zoomEdges.right_edge[2] - zoomEdges.left_edge[2]))
 
                 // draw the arrow:
                 var from = new THREE.Vector3(galX, galY, galZ);
                 // var to = new THREE.Vector3(spinX,spinY,spinZ);
                 var spinDirection = new THREE.Vector3(galSpin[0], galSpin[1], galSpin[2]);
                 // const dir = new THREE.Vector3( 10, 20, 5 );
 
                 // var spinDirection = to.clone().sub(from);
                 var length = spinDirection.length()
 
 
                 // edgeX = ((zoomEdges.left_edge[0]) / (zoomEdges.right_edge[0] - zoomEdges.left_edge[0]))
                 // edgeY = ((zoomEdges.left_edge[1]) / (zoomEdges.right_edge[1] - zoomEdges.left_edge[1]))
                 // edgeZ = ((zoomEdges.left_edge[2]) / (zoomEdges.right_edge[2] - zoomEdges.left_edge[2]))
 
                 edgeX = gridsize / 2
                 edgeY = gridsize / 2
                 edgeZ = gridsize / 2
 
                 var from2 = new THREE.Vector3(gridsize / 2, gridsize / 2, gridsize / 2)
                 var spinDirection2 = new THREE.Vector3(edgeX, edgeY, edgeZ);
                 var length2 = spinDirection2.length() - 1
 
 
                 // var spinLength = (length/(0.33 * gridsize))
 
                 // scale by gridsize:
                 if (gridsize == 256) {
                     // var spinLength = (gridsize/2) + (length/200)
                     var spinLength = ((16 * length) / gridsize)
                 }
                 else if (gridsize == 128) {
                     // var spinLength = (gridsize/4) + (length/200)
                     var spinLength = ((4 * length) / gridsize)
                 }
                 else if (gridsize == 64) {
                     // var spinLength = (gridsize/8) + (length/200)
                     var spinLength = ((1 * length) / gridsize)
                 }
 
                 spinLengthX = Math.min(spinLength, length2)  // so that the arrow doesn't go beyond the box
                 spinLengthX = Math.max(spinLengthX, length2 / 20)  // so that the arrow is not TOO small
 
                 // var spinLength2 = gridsize * ()
 
                 // var length = 50;
                 // var spinArrow = new THREE.ArrowHelper(spinDirection.normalize(), from, length, 0xffffff);
                 var spinArrow = new THREE.ArrowHelper(spinDirection.normalize(), from, spinLengthX, 0xffffff)
                 // var spinArrow2 = new THREE.ArrowHelper(spinDirection2.normalize(), from2, length2, 0xffffff)
                 // starScene.add(spinArrow2)
 
                 starScene.add(spinArrow);
 
                 // console.log('spin arrow loaded',galX,galY,galZ,spinLength,length2)
 
                 ////////
 
                 updateUniforms()
                 // stopLoadingAnimation()
                 resolve()
 
             }
 
         })
 
     })
 }
 
 
 
 function loadZoomDensity(size, type, attr, haloID) {
     // startLoadingAnimation()
     console.log('loading zoom-in density', haloID, size)
     // str2 = 'static/data/' + simID + '/Halos/halo_' + haloID + '/' + type + '/' + size + '_PartType0_' + attr + '.json'
     // console.log(str2)
     return new Promise(resolve => {
         d3.json('static/data/' + simID + '/Halos/halo_' + haloID + '/' + type + '/' + size + '_PartType0_' + attr + '.json').then(function (d) {
             // d3.text('static/data/'+simID+'/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(textData){
             //     textData = textData.replace(/-Infinity/g, '"-Infinity"');
             //     const d = JSON.parse(textData, function(key, value){
             //         return value === "-Infinity" ? -Infinity : value;
             //     });
             // DENSITY USES BLUE CHANNEL OF 3D DATA TEXTURE
 
             min = Infinity
             max = -Infinity
             for (x = 0; x < size; x++) {
                 for (y = 0; y < size; y++) {
                     for (z = 0; z < size; z++) {
                         // if(size==64) dataArray3D[ 3 * ( x + y * size + z * size * size ) + 2 ] = Math.log10(d[x][y][z])
                         dataArray3D[3 * (x + y * size + z * size * size) + 2] = d[x][y][z]
 
                         // if(size==384 || size==512) dataArray3D[ 4 * ( x + y * size + z * size * size ) + 2 ] = d[x][y][z]
                         // else dataArray3D[ 4 * ( x + y * size + z * size * size ) + 2 ] = Math.log10(d[x][y][z])
 
                         if (dataArray3D[3 * (x + y * size + z * size * size) + 2] < min) {
                             min = dataArray3D[3 * (x + y * size + z * size * size) + 2]
                         }
                         if (dataArray3D[3 * (x + y * size + z * size * size) + 2] > max) {
                             max = dataArray3D[3 * (x + y * size + z * size * size) + 2]
                         }
                     }
                 }
             }
 
             // setDensityMinMaxInputValues('density',min,max)
 
             function setDensityMinMaxInputValues(type, min, max) {
                 let minval = document.getElementById(type + '-minval-input')
                 minval.value = round(min, 2)
                 let maxval = document.getElementById(type + '-maxval-input')
                 maxval.value = round(max, 2)
             }
             if (simID != "TNG100_z2.3") {
                 densityUnpackDomain = [-9, -3]
                 setDensityMinMaxInputValues('density', -8, -3)
                 volMaterial.uniforms["u_densityUnpackDomain"].value.set(densityUnpackDomain[0], densityUnpackDomain[1])
             }
 
             if (simID == "TNG100_z2.3") {
 
                 min = Math.log10(3.22215222e-31)
                 max = Math.log10(4.31157793e-19)
                 densityUnpackDomain = [min, max]
                 console.log(densityUnpackDomain)
                 setDensityMinMaxInputValues('density', min, max)
                 volMaterial.uniforms["u_densityUnpackDomain"].value.set(densityUnpackDomain[0], densityUnpackDomain[1])
             }
 
             dm = document.querySelector('#density-minval-input')
             dm.addEventListener('input', updateUniforms);
             // dm.value = -8;
             dmx = document.querySelector('#density-maxval-input')
             dmx.addEventListener('input', updateUniforms);
 
             // updateUniforms()
             // stopLoadingAnimation()
             resolve([min, max])
         })
     })
 }
 
 function setTwoNumberDecimal(el) {
     updateUniforms()
     // el.value = el.value.toFixed(2);
 };
 
 //OG asynccall function:
 async function asyncCall(resolution_bool) {
     startLoadingAnimation()
 
     let init = await init3dDataTexture(gridsize)
     // try{
     var dens = await loadDensity(gridsize, 'PartType0', 'H_number_density')
     densityMin = dens[0]
     densityMax = dens[1]
     // if(!resolution_bool){
     
     var stars = await loadStars()
     var starInfo = await loadStarGalaxyInfo()
 
     // }
     var gas = await loadGas(gridsize, gasAttr, resolution_bool)
     //
     // var zooms = await loadZoomIn(gridsize, gasAttr, resolution_bool, haloID)
     //
     try {
         var darkmatter = await loadDarkMatter(gridsize)
         // volMaterial.uniforms["u_dmVisibility"].value = true
         // volMaterial.needsUpdate = true
     } catch (err) {
         // toggleLayer(1)
         // // volMaterial.uniforms["u_dmVisibility"].value = false
         // // var x = document.getElementById("dm-eye-open");
         // // x.style.display = "none";
         // // var y = document.getElementById("dm-eye-closed");
         // // y.style.display = "inline-block";
         // volMaterial.needsUpdate = true
 
     } finally {
         // toggleLayer(1)
         for (x = 0; x < gridsize; x++) {
             for (y = 0; y < gridsize; y++) {
                 for (z = 0; z < gridsize; z++) {
                     dataArray3D[3 * (x + y * gridsize + z * gridsize * gridsize) + 1] = 0
                 }
             }
         }
         volMaterial.uniforms["u_dmVisibility"].value = false
         // volMaterial.needsUpdate = true
         var x = document.getElementById("dm-eye-open");
         x.style.display = "none";
         var y = document.getElementById("dm-eye-closed");
         y.style.display = "inline-block";
 
     }
     // catch(err){
     //     console.log(err)
     // }
     // finally{
 
     var update3dTexture = update3dDataTexture()
     updateUniforms()
     createSkewerCube(gridsize)
     stopLoadingAnimation()
     // }
 }
 
 // FH asyncall fn:
 
 // async function asyncCall(resolution_bool,zooms=false,halos=null) {
 //     startLoadingAnimation()
 
 //     let init = await init3dDataTexture(gridsize)
 
 
 //         // try{
 //     var dens = await loadDensity(gridsize, 'PartType0', 'H_number_density')
 //     densityMin = dens[0]
 //     densityMax = dens[1]
 //         // if(!resolution_bool){
 //     var stars = await loadStars()
 //         // }
 //     var gas = await loadGas(gridsize, gasAttr, resolution_bool)
 
 //     try {
 //         var darkmatter = await loadDarkMatter(gridsize)
 //             // volMaterial.uniforms["u_dmVisibility"].value = true
 //             // volMaterial.needsUpdate = true
 //     } catch (err) {
 //         // toggleLayer(1)
 //         // // volMaterial.uniforms["u_dmVisibility"].value = false
 //         // // var x = document.getElementById("dm-eye-open");
 //         // // x.style.display = "none";
 //         // // var y = document.getElementById("dm-eye-closed");
 //         // // y.style.display = "inline-block";
 //         // volMaterial.needsUpdate = true
 
 //     } finally {
 //         // toggleLayer(1)
 //         for (x = 0; x < gridsize; x++) {
 //             for (y = 0; y < gridsize; y++) {
 //                 for (z = 0; z < gridsize; z++) {
 //                     dataArray3D[3 * (x + y * gridsize + z * gridsize * gridsize) + 1] = 0
 //                 }
 //             }
 //         }
 //         volMaterial.uniforms["u_dmVisibility"].value = false
 //             // volMaterial.needsUpdate = true
 //         var x = document.getElementById("dm-eye-open");
 //         x.style.display = "none";
 //         var y = document.getElementById("dm-eye-closed");
 //         y.style.display = "inline-block";
 
 //         }
 
 //     // catch(err){
 //     //     console.log(err)
 //     // }
 //     // finally{
 
 //     //  zoom-ins:
 //     // if (zooms=true && halos!=null)  {
 //     //     // console.log('came this far',halos)
 //     //     // halos = haloID
 //     //     var resample = await loadZoomIn(gridsize, gasAttr, resolution_bool, halos)
 //     //     }
 //     //
 
 //     var update3dTexture = update3dDataTexture()
 //     updateUniforms()
 //     createSkewerCube(gridsize)
 //     stopLoadingAnimation()
 //         // }
 // }
 
 // async fn just for zoom-in:
 
 async function asyncZoom(resolution_bool, halos = null) {
     startLoadingAnimation()
 
     let init = await init3dDataTexture(gridsize)
 
     // try{
     var dens = await loadZoomDensity(gridsize, 'PartType0', 'H_number_density', halos)
     densityMin = dens[0]
     densityMax = dens[1]
     // if(!resolution_bool){
     var stars = await loadZoomStars(halos)
     // }
     var gas = await loadZoomGas(gridsize, gasAttr, resolution_bool, halos)
 
     // zoomRes = document.getElementById("size_select").value
 
     // console.log('size',zoomRes,gridsize)
 
     // if (gridsize != zoomRes) {
 
 
     //     gridsize = zoomRes
 
     //     // console.log('are you there',zoom_bool,halos)
 
     //     // var init = init3dDataTexture(gridsize)
 
     //     // asyncCall(true)
     //     //     //check to see which variables are visible and update those immediately
     //     // checkSelectedSimID()
     //     //     // asyncCall()
     //     //     // loadHaloCenters()
 
     //     // createSkewerCube(gridsize)
     //     // updateSkewerEndpoints(gridsize, oldSize)
     //     // toggleXYZGuide()
     //     // updateUniforms()
     //     // toggleGrid()
     //     // camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
     //     // camera.updateProjectionMatrix()
     //     //     // controls
     //     // controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
     //     // controls.update()
     //     }
 
 
     // var update3dTexture = update3dDataTexture()
     // updateUniforms()
     createSkewerCube(gridsize)
     stopLoadingAnimation()
     // }
 }
 
 
 function loadDensity(size, type, attr) {
     // startLoadingAnimation()
     console.log('loading density', size)
     return new Promise(resolve => {
         d3.json('static/data/' + simID + '/' + type + '/' + size + '_' + type + '_' + attr + '.json').then(function (d) {
             // d3.text('static/data/'+simID+'/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(textData){
             //     textData = textData.replace(/-Infinity/g, '"-Infinity"');
             //     const d = JSON.parse(textData, function(key, value){
             //         return value === "-Infinity" ? -Infinity : value;
             //     });
             // DENSITY USES BLUE CHANNEL OF 3D DATA TEXTURE
             // console.log(d,'static/data/' + simID + '/' + type + '/' + size + '_' + type + '_' + attr + '.json')
             min = Infinity
             max = -Infinity
             for (x = 0; x < size; x++) {
                 for (y = 0; y < size; y++) {
                     for (z = 0; z < size; z++) {
                         // if(size==64) dataArray3D[ 3 * ( x + y * size + z * size * size ) + 2 ] = Math.log10(d[x][y][z])
                         dataArray3D[3 * (x + y * size + z * size * size) + 2] = d[x][y][z]
 
                         // if(size==384 || size==512) dataArray3D[ 4 * ( x + y * size + z * size * size ) + 2 ] = d[x][y][z]
                         // else dataArray3D[ 4 * ( x + y * size + z * size * size ) + 2 ] = Math.log10(d[x][y][z])
 
                         if (dataArray3D[3 * (x + y * size + z * size * size) + 2] < min) {
                             min = dataArray3D[3 * (x + y * size + z * size * size) + 2]
                         }
                         if (dataArray3D[3 * (x + y * size + z * size * size) + 2] > max) {
                             max = dataArray3D[3 * (x + y * size + z * size * size) + 2]
                         }
                     }
                 }
             }
 
             // setDensityMinMaxInputValues('density',min,max)
 
             function setDensityMinMaxInputValues(type, min, max) {
                 let minval = document.getElementById(type + '-minval-input')
                 minval.value = round(min, 2)
                 let maxval = document.getElementById(type + '-maxval-input')
                 maxval.value = round(max, 2)
             }
             if (simID != "TNG100_z2.3") {
                 densityUnpackDomain = [-8.5, -3]
                 setDensityMinMaxInputValues('density', -8.5, -3)
                 volMaterial.uniforms["u_densityUnpackDomain"].value.set(densityUnpackDomain[0], densityUnpackDomain[1])
             }
 
             if (simID == "TNG100_z2.3") {
 
                 min = Math.log10(3.22215222e-31)
                 max = Math.log10(4.31157793e-19)
                 densityUnpackDomain = [min, max]
                 //console.log(densityUnpackDomain)
                 setDensityMinMaxInputValues('density', min, max)
                 volMaterial.uniforms["u_densityUnpackDomain"].value.set(densityUnpackDomain[0], densityUnpackDomain[1])
             }
 
             dm = document.querySelector('#density-minval-input')
             dm.addEventListener('input', updateUniforms);
             // dm.value = -8;
             dmx = document.querySelector('#density-maxval-input')
             dmx.addEventListener('input', updateUniforms);
 
             // densityTexture = new THREE.DataTexture3D( arr, size, size, size)
             // densityTexture.format = THREE.RedFormat
             // densityTexture.type = THREE.FloatType
             // densityTexture.minFilter = densityTexture.magFilter = THREE.LinearFilter
             // densityTexture.unpackAlignment = 1
 
             // updateUniforms()
             // stopLoadingAnimation()
             resolve([min, max])
         })
     })
 }
 
 function loadStars() {
     // startLoadingAnimation()
     //console.log('loading stars')
     return new Promise(resolve => {
         while (starScene.children.length > 0) {
             starScene.remove(starScene.children[0]);
         }
         d3.json('static/data/' + simID + '/PartType4/star_particles.json').then(function (d) {
             // //console.log( Object.keys(d).length )
             starData = []
             n = Object.keys(d).length
             // console.log(d[0])
             // console.log(n)
             // min(1.0, (new_dm_val - u_dmClim[0]) / (u_dmClim[1] - u_dmClim[0]));
             //(gas_val - u_gasClim[0]) / (u_gasClim[1] - u_gasClim[0])  
 
             // //console.log(d[0])
             //console.log(n)
             // m = gridsize / (edges.right_edge[0] - edges.left_edge[0]) //take into account other dimensions
             var starGeometry = new THREE.BufferGeometry();
             var starPositions = new Float32Array(n * 3)
             if (Object.keys(d).length > 0) {
                 for (i = 0; i < n; i++) {
                     mx = gridsize * ((d[i][0] - edges.left_edge[0]) / (edges.right_edge[0] - edges.left_edge[0]))
                     my = gridsize * ((d[i][1] - edges.left_edge[1]) / (edges.right_edge[1] - edges.left_edge[1]))
                     mz = gridsize * ((d[i][2] - edges.left_edge[2]) / (edges.right_edge[2] - edges.left_edge[2]))
                     let vertex = new THREE.Vector3(mx, my, mz)
                     vertex.toArray(starPositions, i * 3)
                     starData[i] = [d[i][0], //x
                     d[i][1], //y
                     d[i][2], //z
                     d[i][3], //subhalo ID
                     d[i][4]
                     ] //solar mass
 
                 }
                 // console.log('star positions:')
                 // console.log(starPositions)
                 starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)) //.onUpload( disposeArray )
                 starGeometry.computeBoundingBox()
                 boxOfStarPoints = new THREE.Points(starGeometry, starMaterial);
                 boxOfStarPoints.layers.enable(3)
                 boxOfStarPoints.layers.set(3)
                 boxOfStarPoints.renderOrder = 0
                 starScene.add(boxOfStarPoints);
                 var x = document.getElementById("star-eye-open");
                 x.style.display = "inline-block";
                 var y = document.getElementById("star-eye-closed");
                 y.style.display = "none";
                 // renderer.setRenderTarget( target )
                 // renderer.render( starScene, camera );
                 // renderer.setRenderTarget( null )
                 updateUniforms()
                 // stopLoadingAnimation()
                 resolve()
             }
         })
 
     })
 }
 
 async function loadStarGalaxyInfo(){
     starGalaxyInfo = await d3.json('static/data/' + simID + '/galaxies_' + simID + '.json')
 
     // console.log('filterGalaxies function',sim,'static/data/' + sim + '/galaxies_' + sim + '.json')
 
     // var filteredData = starGalaxyInfo.slice() //slice of data
 
     // var groupNums = filteredData.map(d => d.groupNum)
     // var haloIDs = filteredData.map(d => d.haloID)
     // var groupMasses = filteredData.map(d => d['mh'])
 
 
 
 }
 
 // OG starcaster
 // function starCaster() {
 
 //     starcaster.setFromCamera(mouse, camera);
 //     // starcaster.layers.enableAll()
 //     intersects = []
 //     // intersects = starcaster.intersectObjects(boxOfStarPoints, true);
 //     boxOfStarPoints.raycast(starcaster, intersects);
 //     // console.log('intersects',intersects)
 //     // intersection = ( intersections.length ) > 0 ? intersections[ 0 ] : null;
 //     if (intersects.length > 0) {
 //         star = starData[intersects[0].index]
 //         let div = document.getElementById("star-details")
 //         div.innerHTML = `
 //         <h3>star particle details</h3>\n
 //         <table>
 //         <tr>
 //             <td class="d1">
 //                 group id
 //             </td>
 //             <td class="d2">
 //                 ` + star[3] + `
 //             </td>
 //             <td class="d3">
 //             </td>
 //         </tr>
 //         <tr>
 //             <td class="d1">
 //                 mass
 //             </td>
 //             <td class="d2">
 //                 ` + star[4] + `
 //             </td>
 //             <td class="d3">
 //                 M<sub>&#9737;</sub>              
 //             </td>
 //         </tr>
 //         <tr>
 //             <td class="d1">
 //                 x
 //             </td>
 //             <td class="d2">
 //                 ` + star[0] + `
 //             </td>
 //             <td class="d3">
 //                 Mpc</sub>              
 //             </td>
 //         </tr>
 //         <tr>
 //             <td class="d1">
 //                 y
 //             </td>
 //             <td class="d2">
 //                 ` + star[1] + `
 //             </td>
 //             <td class="d3">
 //                 Mpc</sub>              
 //             </td>
 //         </tr>
 //         <tr>
 //             <td class="d1">
 //                 z
 //             </td>
 //             <td class="d2">
 //                 ` + star[2] + `
 //             </td>
 //             <td class="d3">
 //                 Mpc</sub>              
 //             </td>
 //         </tr>
 
 //     </table>`
 //             //"<h4></h4>\n : " + star[3] + "<br> Mass: " + star[4] + " (Msun)<br> x: " + star[0] + " (Mpc)<br> y: " + star[1] + " (Mpc)<br> z: " + star[2] + " (Mpc)"
 //     }
 // }
 
 //FH starcaster
 async function starCaster() {
 
     // console.log('starcaster',simID)
 
     //load in galaxies data:
     // const data = await d3.json('static/data/' + simID + '/galaxies_' + simID + '.json')
 
     // console.log('filterGalaxies function',sim,'static/data/' + sim + '/galaxies_' + sim + '.json')
 
     var filteredData = starGalaxyInfo.slice() //slice of data
 
     var groupNums = filteredData.map(d => d.groupNum)
     var haloIDs = filteredData.map(d => d.haloID)
     var groupMasses = filteredData.map(d => d['mh'])
 
     starcaster.setFromCamera(mouse, camera);
     // starcaster.layers.enableAll()
     intersects = []
     // intersects = starcaster.intersectObjects(boxOfStarPoints, true);
     boxOfStarPoints.raycast(starcaster, intersects);
     // console.log('intersects',intersects)
     // intersection = ( intersections.length ) > 0 ? intersections[ 0 ] : null;
     if (intersects.length > 0) {
         star = starData[intersects[0].index]
         let div = document.getElementById("star-details")
 
         //find index of the intersecting star particle
         var index = groupNums.indexOf(star[3])
 
         // console.log('HEY',index)
         if (index != -1) {
 
             //find group mass from this index
             var groupMass = groupMasses[index].toExponential(3)
 
             var haloID = haloIDs[index]
 
             // console.log('starcaster',groupMass)
 
             // const found = groupNums.find(id => id === star[3]);
 
             div.innerHTML = `
         <div class="panel-header">
         Star particle details
 
         <img class="close-icon" src="static/assets/close_icon.svg"
         alt="close panel" role="button" onclick="hidePanel('star-details')" />
 
         </div>\n
         <table>
         <tr>
             <td class="d1">
                 halo ID
             </td>
             <td class="d2">
                 ` + haloID + `
             </td>
             <td class="d3">
             </td>
         </tr>
         <tr>
             <td class="d1">
                 halo mass
             </td>
             <td class="d2">
                 ` + groupMass + `
             </td>
             <td class="d3">
                 M<sub>&#9737;</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 x
             </td>
             <td class="d2">
                 ` + star[0] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 y
             </td>
             <td class="d2">
                 ` + star[1] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 z
             </td>
             <td class="d2">
                 ` + star[2] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         
     </table>`
             //"<h4></h4>\n : " + star[3] + "<br> Mass: " + star[4] + " (Msun)<br> x: " + star[0] + " (Mpc)<br> y: " + star[1] + " (Mpc)<br> z: " + star[2] + " (Mpc)"
         }
 
         else {
             div.innerHTML = `
             <div class="panel-header">
             Star particle details
 
             <img class="close-icon" src="static/assets/close_icon.svg"
             alt="close panel" role="button" onclick="hidePanel('star-details')" />
 
         </div>\n
         <table>
         <tr>
             <td class="d1">
                 group ID
             </td>
             <td class="d2">
                 ` + star[3] + `
             </td>
             <td class="d3">
             </td>
         </tr>
         <tr>
             <td class="d1">
                 particle mass
             </td>
             <td class="d2">
                 ` + star[4] + `
             </td>
             <td class="d3">
                 M<sub>&#9737;</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 x
             </td>
             <td class="d2">
                 ` + star[0] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 y
             </td>
             <td class="d2">
                 ` + star[1] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         <tr>
             <td class="d1">
                 z
             </td>
             <td class="d2">
                 ` + star[2] + `
             </td>
             <td class="d3">
                 Mpc</sub>              
             </td>
         </tr>
         
     </table>`
         }
     }
 }
 
 
 function disposeArray() {
     this.array = null;
 }
 
 function startLoadingAnimation() {
     loading = document.getElementById("loading-animation")
     loading.style.display = "inline-block"
     document.body.style.cursor = "progress";
 }
 
 function stopLoadingAnimation() {
     loading = document.getElementById("loading-animation")
     loading.style.display = "none"
     document.body.style.cursor = "default";
 }
 
 function setupStarScene() {
 
     starScene = new THREE.Scene();
     starScene.background = new THREE.Color("rgb(0,0,0)")
     // starCol = new THREE.Color(0.8, 0.8, 0.0)
     starCol = new THREE.Color(1.0, 1.0, 1.0)
 
     // //console.log(starCol)
     starMaterial = new THREE.ShaderMaterial({
 
         uniforms: {
             Col: { value: new THREE.Vector4(starCol.r, starCol.g, starCol.b, 1.0) },
             u_xyzMin: { value: null },
             u_xyzMax: { value: null },
             u_gridsize: { value: gridsize },
             u_starSize: { value: document.getElementById("star-size-slider").value }
             // maxCol: { value: new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0) }
         },
         vertexShader: document.getElementById('vertexshader-star').textContent,
         fragmentShader: document.getElementById('fragmentshader-star').textContent,
 
         // blending:       THREE.AdditiveBlending,
         blending: THREE.CustomBlending,
         // blendEquation:  THREE.AddEquation, //default
         blendSrc: THREE.OneFactor,
         blendDst: THREE.ZeroFactor,
         depthTest: true,
         depthWrite: true,
         transparent: true,
         opacity: 1.0,
         precision: 'highp',
         dithering: true,
         side: THREE.DoubleSide,
         clipping: false
         // alphaTest:      0.3
     });
 }
 
 function setupStarSaoScene() {
     starSaoScene = new THREE.Scene();
     starSaoScene.background = new THREE.Color("rgb(0,0,0)")
     starSaoMaterial = new THREE.ShaderMaterial({
         uniforms: {
             tDiffuse: { value: starTarget.texture },
             starDepth: { value: starTarget.depthTexture },
             u_screenHeight: { value: window.innerHeight },
             u_screenWidth: { value: window.innerWidth },
             u_cameraNear: { value: camera.near },
             u_cameraFar: { value: camera.far }
         },
         vertexShader: document.getElementById('vertexshader-starSAO').textContent,
         fragmentShader: document.getElementById('fragmentshader-starSAO').textContent,
 
         // blending:       THREE.AdditiveBlending,
         blending: THREE.CustomBlending,
         // blendEquation:  THREE.AddEquation, //default
         blendSrc: THREE.OneFactor,
         blendDst: THREE.ZeroFactor,
         depthTest: false,
         depthWrite: false,
         transparent: false,
         opacity: 1.0,
         precision: 'highp',
         dithering: false,
         side: THREE.DoubleSide,
         clipping: false
         // alphaTest:      0.3
     });
     starSaoMaterial.needsUpdate = true
 
     var quad = new THREE.Mesh(
         new THREE.PlaneGeometry(2, 2),
         starSaoMaterial
     );
     quad.frustumCulled = false;
 
     starSaoScene.add(quad);
 }
 
 function setupSkewerScene() {
     skewerScene = new THREE.Scene();
     skewerScene.background = new THREE.Color("rgb(0,0,0)")
     emptyData = new Uint8Array(3 * 1000)
     emptyData.fill(255)
     emptyTexture = new THREE.DataTexture(emptyData.fill(1), 1, 100, THREE.RGBFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping,
         THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter)
     emptyTexture.needsUpdate = true
     skewerMaterial = new THREE.ShaderMaterial({
         uniforms: {
             Col: { value: new THREE.Vector4(1.0, 1.0, 0.0, 1.0) },
             u_xyzMin: { value: new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4]) },
             u_xyzMax: { value: new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5]) },
             u_gridsize: { value: gridsize },
             skewer_tex: {
                 value: emptyTexture,
             }
         },
         vertexShader: document.getElementById('vertexshader-skewer').textContent,
         fragmentShader: document.getElementById('fragmentshader-skewer').textContent,
         // blending:       THREE.CustomBlending,
         // // blendEquation:  THREE.AddEquation, //default
         // blendSrc:       THREE.OneFactor,
         // blendDst:       THREE.ZeroFactor,
         depthTest: true,
         depthWrite: true,
         transparent: false,
         dithering: true,
         vertexColors: false,
         morphTargets: true,
         morphNormals: true,
     });
 
 }
 
 function setupRenderTarget() {
 
     //STAR SCENE TARGET
 
     if (starTarget) starTarget.dispose();
 
     var format = THREE.DepthFormat
     var type = THREE.FloatType
 
     var devicePixelRatio = window.devicePixelRatio || 1;
     const size = new THREE.Vector2()
     renderer.getSize(size);
 
     starTarget = new THREE.WebGLRenderTarget(size.x, size.y);
     starTarget.texture.format = THREE.RGBAFormat;
     starTarget.texture.minFilter = THREE.LinearFilter;
     starTarget.texture.magFilter = THREE.LinearFilter;
     starTarget.texture.generateMipMaps = false
     starTarget.stencilBuffer = (format === THREE.DepthStencilFormat) ? true : false;
     starTarget.depthBuffer = true;
     starTarget.depthTexture = new THREE.DepthTexture();
     starTarget.depthTexture.format = format
     starTarget.depthTexture.type = type;
     starTarget.scissorTest = true;
     starTarget.scissor
 
     // STAR AMBIENT OCCLUSION SCENE TARGET
     // if (starSaoTarget) starSaoTarget.dispose();
     starSaoTarget = new THREE.WebGLRenderTarget(size.x, size.y);
     starSaoTarget.texture.format = THREE.RGBAFormat;
     starSaoTarget.texture.minFilter = THREE.LinearFilter;
     starSaoTarget.texture.magFilter = THREE.LinearFilter;
     starSaoTarget.texture.generateMipMaps = false
     starSaoTarget.stencilBuffer = (format === THREE.DepthStencilFormat) ? true : false;
     starSaoTarget.depthBuffer = false;
     // starSaoTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
     // starSaoTarget.depthTexture.format = format
     // starSaoTarget.depthTexture.type = type;
     starSaoTarget.scissorTest = true;
 
     //SKEWER SCENE TARGET
 
     if (skewerTarget) skewerTarget.dispose();
 
     skewerTarget = new THREE.WebGLRenderTarget(size.x, size.y);
     skewerTarget.texture.format = THREE.RGBAFormat;
     skewerTarget.texture.minFilter = THREE.LinearFilter;
     skewerTarget.texture.magFilter = THREE.LinearFilter;
     skewerTarget.texture.generateMipMaps = true
     skewerTarget.stencilBuffer = (format === THREE.DepthStencilFormat) ? true : false;
     skewerTarget.depthBuffer = true;
     skewerTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
     skewerTarget.depthTexture.format = format
     skewerTarget.depthTexture.type = type;
     skewerTarget.scissorTest = true;
     skewerTarget.scissor
 
     setupStarScene()
     setupStarSaoScene()
     setupSkewerScene()
 }
 
 // function loadHaloCenters() {
 //     d3.json('static/data/' + simID + '/PartType5/black_hole_particles.json').then(function(data) {
 //         galaxy_centers = data
 //         div = document.getElementById("galaxylist")
 //         str = '<div id="galaxy-list">'
 //         for (i = 0; i < Object.keys(galaxy_centers).length; i++) {
 //             m = (edges.right_edge[0] - edges.left_edge[0])
 //             str += '<button onclick="goToPoint(' + galaxy_centers[i].x*m + ',' + galaxy_centers[i].y*m + ',' + galaxy_centers[i].z*m + ')">'
 //             str += i + '<br>'
 //             str += "</p>"
 //         }
 //         str += "</div>"
 //         div.innerHTML = str
 //     })
 // }
 
 function zoomIn() {
     let ix = document.getElementById("input-coord-x").value
     let iy = document.getElementById("input-coord-y").value
     let iz = document.getElementById("input-coord-z").value
 
     goToPoint(ix, iy, iz)
 }
 
 function goToPoint(x, y, z, delta = 0.1) {
     //console.log(x, y, z)
     //console.log('click click')
     // x*=0.6776999078
     // y*=0.6776999078
     // z*=0.6776999078
 
     width_Mpc = (edges.right_edge[0] - edges.left_edge[0])
 
     //     delta = 0.1
     domainXYZ[0] = (x / width_Mpc) - delta
     domainXYZ[1] = (x / width_Mpc) + delta
     domainXYZ[2] = (y / width_Mpc) - delta
     domainXYZ[3] = (y / width_Mpc) + delta
     domainXYZ[4] = (z / width_Mpc) - delta
     domainXYZ[5] = (z / width_Mpc) + delta
 
     /////////////// forcing the domains to be within the voxelized volume!
     /// - to remove edge effects for example
 
     domainXYZ[0] = Math.max(domainXYZ[0], 0)
     domainXYZ[2] = Math.max(domainXYZ[2], 0)
     domainXYZ[4] = Math.max(domainXYZ[4], 0)
 
     domainXYZ[1] = Math.min(domainXYZ[1], 1)
     domainXYZ[3] = Math.min(domainXYZ[3], 1)
     domainXYZ[5] = Math.min(domainXYZ[5], 1)
 
     ////////////////
 
 
     updateXYZDomain('x', domainXYZ[0], domainXYZ[1])
     updateXYZDomain('y', domainXYZ[2], domainXYZ[3])
     updateXYZDomain('z', domainXYZ[4], domainXYZ[5])
 
 
     m = gridsize / width_Mpc
 
     mx = gridsize * ((x - edges.left_edge[0]) / (edges.right_edge[0] - edges.left_edge[0]))
     my = gridsize * ((y - edges.left_edge[1]) / (edges.right_edge[1] - edges.left_edge[1]))
     mz = gridsize * ((z - edges.left_edge[2]) / (edges.right_edge[2] - edges.left_edge[2]))
     // console.log('just m',m,gridsize,width_Mpc,edges)
     // console.log("mx,my,mz",mx,my,mz)
     x *= mx
     y *= my
     z *= mz
     // console.log(x, y, z)
     camera.lookAt(x / mx, y / my, z / mz)
     controls.target.set(x / mx, y / my, z / mz);
     camera.zoom = 9;
 
 
     let margin = { top: 20, right: 15, bottom: 30, left: 20 };
     let width = 343,
         height = 40
     var x = d3.scaleLinear()
         .domain([0.0, 1.0])
         .range([margin.left + width * domainXYZ[0], (width - margin.right) * domainXYZ[1]]);
     xBrush.call(xBrusher).call(xBrusher.move, x.range())
 
     var y = d3.scaleLinear()
         .domain([0.0, 1.0])
         .range([margin.left + width * domainXYZ[2], (width - margin.right) * domainXYZ[3]]);
     yBrush.call(yBrusher).call(yBrusher.move, y.range())
 
     var z = d3.scaleLinear()
         .domain([0.0, 1.0])
         .range([margin.left + width * domainXYZ[4], (width - margin.right) * domainXYZ[5]]);
     zBrush.call(zBrusher).call(zBrusher.move, z.range())
     updateUniforms()
     camera.updateProjectionMatrix()
 
 
 
 }
 
 function initColor(type) {
 
     w = 256
     h = 1
     size = w * h
     data = new Uint8Array(3 * size)
     for (i = 0; i < w; i++) {
         stride = i * 3
         a = i / w
         if (type == 'PartType0') c = gasMinCol.clone().lerp(gasMaxCol, a)
         if (type == 'PartType1') c = dmMinCol.clone().lerp(dmMaxCol, a)
         if (type == 'PartType4') c = starMinCol.clone().lerp(starMaxCol, a)
         if (type == 'PartType5') c = bhMinCol.clone().lerp(bhMaxCol, a)
         data[stride] = Math.floor(c.r * 255)
         data[stride + 1] = Math.floor(c.g * 255)
         data[stride + 2] = Math.floor(c.b * 255)
     }
     cmtexture[type] = new THREE.DataTexture(data, w, h, THREE.RGBFormat)
 
 }
 
 function changeColor() {
     /**
      * * changeColor() is called when the value in a color selection box is changed and updates corresponding material uniforms
      */
 
     gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
     gasMidCol = new THREE.Color(document.querySelector("#gasMidCol").value);
     gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
     gasMinA = document.querySelector("#gasMinA").value;
     gasMidA = document.querySelector("#gasMidA").value;
     gasMaxA = document.querySelector("#gasMaxA").value;
     dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
     dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
     dmMinA = document.querySelector("#dmMinA").value;
     dmMaxA = document.querySelector("#dmMaxA").value;
     bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
     bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);
     dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
     dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
     // starCol = new THREE.Color(document.querySelector("#starCol").value);
     starMinCol = new THREE.Color(document.querySelector("#starMinCol").value);
     starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);
     bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
     bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);
 
     col = document.getElementById('gas-colorscale')
     col.style.background = 'linear-gradient( 0.25turn, #' + gasMinCol.getHexString() + ', #' + gasMidCol.getHexString() + ', #' + gasMaxCol.getHexString() + ')'
     col = document.getElementById('dm-colorscale')
     col.style.background = 'linear-gradient( 0.25turn, #' + dmMinCol.getHexString() + ', #' + dmMaxCol.getHexString() + ')'
     col = document.getElementById('star-colorscale')
     col.style.background = 'linear-gradient( 0.25turn, #' + starMinCol.getHexString() + ', #' + starMaxCol.getHexString() + ')'
     col = document.getElementById('bh-colorscale')
     col.style.background = 'linear-gradient( 0.25turn, #' + bhMinCol.getHexString() + ', #' + bhMaxCol.getHexString() + ')'
 
     document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
     document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value
     document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value
     document.querySelector("#dmMinCol").style.backgroundColor = document.querySelector("#dmMinCol").value
     document.querySelector("#dmMaxCol").style.backgroundColor = document.querySelector("#dmMaxCol").value
     document.querySelector("#starMinCol").style.backgroundColor = document.querySelector("#starMinCol").value
     document.querySelector("#starMaxCol").style.backgroundColor = document.querySelector("#starMaxCol").value
     document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value
     document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value
 
 
     // materialGas.uniforms.minCol.value = new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0);
     // materialGas.uniforms.maxCol.value = new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0);
     // materialDarkMatter.uniforms.Col.value = new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0);
     // materialDarkMatter.uniforms.minCol.value = new THREE.Vector4(dmMinCol.r,dmMinCol.g,dmMinCol.b,1.0);
     // materialDarkMatter.uniforms.maxCol.value = new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0);
 
     // materialStar.uniforms.Col.value = new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0);
     // // materialStar.uniforms.maxCol.value = new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0);
     // materialBlackHole.uniforms.minCol.value = new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0);
     // materialBlackHole.uniforms.maxCol.value = new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0);
 
     localStorage.setItem('gasMinCol', "#" + gasMinCol.getHexString());
     localStorage.setItem('gasMidCol', "#" + gasMidCol.getHexString());
     localStorage.setItem('gasMaxCol', "#" + gasMaxCol.getHexString());
 
     localStorage.setItem('gasMinA', "#" + gasMinA);
     localStorage.setItem('gasMidA', "#" + gasMidA);
     localStorage.setItem('gasMaxA', "#" + gasMaxA);
 
     localStorage.setItem('dmMinCol', "#" + dmMinCol.getHexString());
     localStorage.setItem('dmMaxCol', "#" + dmMaxCol.getHexString());
 
     localStorage.setItem('dmMinA', "#" + dmMinA);
     localStorage.setItem('dmMaxA', "#" + dmMaxA);
 
     localStorage.setItem('starMinCol', "#" + starMinCol.getHexString());
     localStorage.setItem('starMaxCol', "#" + starMaxCol.getHexString());
 
     localStorage.setItem('bhMinCol', "#" + bhMinCol.getHexString());
     localStorage.setItem('bhMaxCol', "#" + bhMaxCol.getHexString());
 
     if (material || gasMaterial || dmMaterial || starMaterial || bhMaterial || volMaterial) {
         updateUniforms()
     }
 
 }
 
 function changeSkewerColor() {
     skewerMinCol = new THREE.Color(document.getElementById("skewerMinCol").value)
     skewerMaxCol = new THREE.Color(document.getElementById("skewerMaxCol").value)
 
     col = document.getElementById('skewer-colorscale')
     col.style.background = 'linear-gradient( 0.25turn, #' + skewerMinCol.getHexString() + ', #' + skewerMaxCol.getHexString() + ')'
 
     document.querySelector("#skewerMinCol").style.backgroundColor = document.querySelector("#skewerMinCol").value
     document.querySelector("#skewerMaxCol").style.backgroundColor = document.querySelector("#skewerMaxCol").value
 
 
     for (i = 0; i < lines.length; i++) {
         lines[i].material.uniforms["u_low_col"].value = new THREE.Vector4(skewerMinCol.r, skewerMinCol.g, skewerMinCol.b, 1.0)
         lines[i].material.uniforms["u_high_col"].value = new THREE.Vector4(skewerMaxCol.r, skewerMaxCol.g, skewerMaxCol.b, 1.0)
         lines[i].material.uniformsNeedUpdate = true
     }
 }
 
 function createSkewerCube(size) {
     /**
      * * createSkewerCube() creates an invisible cube that is scaled to the extents of the domain of the data
      * * this is used for using a raycaster when placing skewers
      * size = voxels per edge
      */
     // //console.log(size)
     clearLayer(8)
 
     min = new THREE.Vector3(domainXYZ[0] * size, domainXYZ[2] * size, domainXYZ[4] * size)
     max = new THREE.Vector3(domainXYZ[1] * size, domainXYZ[3] * size, domainXYZ[5] * size)
     diff = max.sub(min)
     var geometry = new THREE.BoxBufferGeometry(diff.x, diff.y, diff.z);
     var material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, transparent: false, opacity: 1.0, side: THREE.DoubleSide });
     material.depthWrite = false;
     cube = new THREE.Mesh(geometry, material);
     cube.position.set(diff.x / 2 + min.x, diff.y / 2 + min.y, diff.z / 2 + min.z);
     cube.layers.enable(8)
     cube.layers.set(8)
     cube.renderOrder = 1
     cube.visible = false
     scene.add(cube);
 
     edges_scaled = {
         'left_edge': [0.0, 0.0, 0.0],
         'right_edge': [size, size, size]
     }
 }
 
 function animate() {
     /**
      * * animate()
      */
     requestAnimationFrame(animate);
 
     // required if controls.enableDamping or controls.autoRotate are set to true
     controls.update();
 
     render()
     // renderer.render( scene, camera );
 }
 
 function updateCameraNearAndFar() {
     let dist = Math.sqrt((camera.position.x - (gridsize / 2)) ** 2 + (camera.position.y - (gridsize / 2)) ** 2 + (camera.position.z - (gridsize / 2)) ** 2)
     let sigma = ((gridsize) / 2) * Math.sqrt(3) //radius of imaginary sphere surrounding the volume cube. it is centered at 0
     camera.near = Math.max(dist - sigma, 0.01)
     camera.far = Math.abs(dist + sigma)
     if (starSaoMaterial) {
         starSaoMaterial.uniforms["u_cameraNear"].value = camera.near
         starSaoMaterial.uniforms["u_cameraFar"].value = camera.far
         starSaoMaterial.needsUpdate = true
 
     }
     if (volMaterial) {
         volMaterial.uniforms["u_cameraNear"].value = camera.near
         volMaterial.uniforms["u_cameraFar"].value = camera.far
         volMaterial.needsUpdate = true
     }
     camera.updateProjectionMatrix()
 }
 
 function render() {
     /**
      * * render()
      */
     // controls.update()
     updateCameraNearAndFar()
     renderRequested = false;
     //render stars into target
     renderer.setRenderTarget(null)
 
     // render star depth buffer
     if (starTarget) {
         renderer.setRenderTarget(starTarget)
         renderer.render(starScene, camera);
         if (volMaterial) {
             volMaterial.uniforms["u_starDiffuse"].value = starTarget.texture
             volMaterial.uniforms["u_starDepth"].value = starTarget.depthTexture
             // starSaoMaterial.needsUpdate = true
         }
         if (starSaoMaterial) {
             starSaoMaterial.uniforms["tDiffuse"].value = starTarget.texture
             starSaoMaterial.uniforms["starDepth"].value = starTarget.depthTexture
         }
         renderer.setRenderTarget(null)
     }
     // renderer.render(starScene, camera);
 
     // star particle ambient occlusion pass
     if (starSaoTarget) {
 
         renderer.setRenderTarget(starSaoTarget)
         renderer.render(starSaoScene, camera);
         if (volMaterial) {
             // update starDiffuse uniform with new values from SAO shader pass
             volMaterial.uniforms["u_starDiffuse"].value = starSaoTarget.texture
             // volMaterial.needsUpdate = true
         }
         renderer.setRenderTarget(null)
     }
 
 
     // render skewer depth buffer
     if (skewerTarget) {
         renderer.setRenderTarget(skewerTarget)
         renderer.render(skewerScene, camera);
         if (volMaterial) {
             volMaterial.uniforms["u_skewerDiffuse"].value = skewerTarget.texture
             volMaterial.uniforms["u_skewerDepth"].value = skewerTarget.depthTexture
         }
         renderer.setRenderTarget(null)
     }
 
     let divGrid = (document.getElementById("grid-check")).checked
     let divGridRadio1 = (document.getElementById("grid-radio-1")).checked
     if (divGrid && divGridRadio1) {
         let vector = new THREE.Vector3()
         dir = camera.getWorldDirection(vector)
         staticGrid.lookAt(camera.position.x, camera.position.y, camera.position.z)
         staticGrid.rotateX(Math.PI / 2)
     }
     // renderer.render(starSaoScene, camera);
 
     renderer.render(scene, camera);
 
 };
 
 function requestRenderIfNotRequested() {
     if (!renderRequested) {
         renderRequested = true;
         requestAnimationFrame(render)
     }
 }
 
 function round(value, decimals) {
     /**
      * * round() to a certain number of decimals 
      */
     return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
 }
 
 function toggleDrawSkewerMode() {
     /*
      * * toggleDrawSkewerMode() turns the visibility of placed skewers on and off 
      */
     drawSkewers = !drawSkewers
     if (drawSkewers) {
         // document.getElementById('skewer-laser').style.filter = 'invert(98%) sepia(0%) saturate(51%) hue-rotate(144deg) brightness(117%) contrast(100%)'
         document.getElementById('skewer-mode-button').style.backgroundColor = '#9F65BB'
         document.getElementById('skewer-mode-button').innerHTML = '<img id="skewer-laser" class="laser-icon" src="static/assets/laser.svg"/> Exit skewer mode'
         document.getElementById('skewer-mode-description').innerHTML = 'Click on the volume to place skewers. Exit skewer mode to rotate the volume.'
     } else {
         // document.getElementById('skewer-laser').style.filter = ''
         document.getElementById('skewer-mode-button').style.backgroundColor = '#CDA2E1'
         document.getElementById('skewer-mode-button').innerHTML = '<img id="skewer-laser" class="laser-icon" src="static/assets/laser.svg"/> Enter skewer mode'
         document.getElementById('skewer-mode-description').innerHTML = 'Use skewer mode to place skewers on the volume.'
     }
 }
 
 function toggleValueThreshold(type, e) {
     /*
      * * toggleValueThreshold() enforces the 'min' or 'max' checkbox state for controlling the color scale value
      * example: unchecked (default) users can change the value in the number input below. when checked, returns the value to the min or max
      type = particle type. 'gas' or 'bh'
      e = 'min' or 'max' checkbox
      */
 
     if (type == 'gas' && e == 'min') {
         document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
         if (document.getElementById("gas-min-check").checked) {
             type = 'PartType0'
             attr = document.getElementById('gas_select').value
             findMinMax(type, attr, e)
         } else {
             gasMaterial.uniforms["u_clim"].value.set(document.querySelector('#gas-minval-input').value, document.querySelector('#gas-maxval-input').value);
         }
     }
     if (type == 'gas' && e == 'max') {
         document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);
         if (document.getElementById("gas-max-check").checked) {
             type = 'PartType0'
             attr = document.getElementById('gas_select').value
             findMinMax(type, attr, e)
         } else {
             materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
         }
     }
     if (type == 'bh' && e == 'min') {
         document.getElementById("bh-minval-input").disabled = (document.getElementById("bh-min-check").checked);
         if (document.getElementById("bh-min-check").checked) {
             type = 'PartType5'
             attr = document.getElementById('bh_select').value
             findMinMax(type, attr, e)
         } else {
             materialBlackHole.uniforms.min.value = document.getElementById('bh-minval-input').value
         }
     }
     if (type == 'bh' && e == 'max') {
         document.getElementById("bh-maxval-input").disabled = (document.getElementById("bh-max-check").checked);
         if (document.getElementById("bh-max-check").checked) {
             type = 'PartType5'
             attr = document.getElementById('bh_select').value
             findMinMax(type, attr, e)
         } else {
             materialBlackHole.uniforms.max.value = document.getElementById('bh-maxval-input').value
         }
     }
 
     function findMinMax(type, attr, e) {
         let min, max
         for (i = 0; i < particles.length; i++) {
             if (particles[i].particle_type == type && particles[i].attribute == attr) {
                 min = particles[i].min
                 max = particles[i].max
             }
         }
         if (type == 'PartType0') {
             if (e == 'min') {
                 materialGas.uniforms.min.value = min
             }
             if (e == 'max') {
                 materialGas.uniforms.max.value = max
             }
         }
         if (type == 'PartType5') {
             if (e == 'min') {
                 materialBlackHole.uniforms.min.value = min
             }
             if (e == 'max') {
                 materialBlackHole.uniforms.max.value = max
             }
         }
     }
 }
 
 function clipPoints(type, e) {
     /*
      * * clipPoints() hides particles above and below the value thresholds 
      !? can this work with the volume renderer? does it make sense?
      */
 
     minClip = document.getElementById(type + "-min-clip-check").checked
     maxClip = document.getElementById(type + "-max-clip-check").checked
     if (type == 'gas') {
         if (e == 'min') {
             materialGas.uniforms.minClip.value = minClip
         }
         if (e == 'max') {
             materialGas.uniforms.maxClip.value = maxClip
         }
     }
     if (type == 'bh') {
         if (e == 'min') {
             materialBlackHole.uniforms.minClip.value = minClip
         }
         if (e == 'max') {
             materialBlackHole.uniforms.maxClip.value = maxClip
         }
     }
 }
 
 function updateUnits(type, units) {
     /**
      * * updateUnits() Updates the units displayed underneath the number input box
      */
     if (type == 'PartType0') {
         gas_units = document.getElementsByClassName('gas-attr-units')
         for (i = 0; i < gas_units.length; i++) {
             gas_units[i].textContent = units
         }
     }
     if (type == 'PartType5') {
         bh_units = document.getElementsByClassName('bh-attr-units')
         for (i = 0; i < bh_units.length; i++) {
             bh_units[i].textContent = units
         }
     }
 }
 
 // check to see if the mouse is over a container. This is used when drawing skewers
 $(".container").hover(function () {
     container_hover = true;
 }, function () {
     container_hover = false;
 });
 
 
 
 function deleteLine(idx) {
     /**
      * * deleteLine() removes a skewer from the scene
      */
     let del = document.getElementById('skewer-coords-' + idx + '')
     del.remove()
     skewerScene.remove(lines[idx])
 }
 
 function retryLine(idx) {
     /**
      * * retryLine() requests another spectrum if the first one did not compute
      */
     requestSpectrum(idx)
 }
 
 function getDateDiff(a, b) {
     diff = Math.abs(b - a)
     diff = Math.ceil(diff / (1000));
     return diff
 }
 
 function requestSimpleLineData(idx) {
     pt1 = scalePointCoords(skewers[idx].point1)
     pt2 = scalePointCoords(skewers[idx].point2)
 
     skewers[idx].cdStart = new Date()
 
     buttonId = 'p1-range-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
 
     buttonId = 'p2-range-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
 
     buttonId = 'simple-line-request-button-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
 
     //console.log(pt1, pt2)
     sendLine(idx, pt1, pt2)
     div.innerText = 'requesting skewer data . . . '
 
     function scalePointCoords(pt) {
         x_scale = (edges_scaled.right_edge[0] - edges_scaled.left_edge[0]) / (edges.right_edge[0] - edges.left_edge[0])
         y_scale = (edges_scaled.right_edge[1] - edges_scaled.left_edge[1]) / (edges.right_edge[1] - edges.left_edge[1])
         z_scale = (edges_scaled.right_edge[2] - edges_scaled.left_edge[2]) / (edges.right_edge[2] - edges.left_edge[2])
         pt.x = pt.x / x_scale
         pt.y = pt.y / y_scale
         pt.z = pt.z / z_scale
         return pt
     }
 
     function sendLine(idx, point1, point2) {
         //console.log(point1, point2)
         socket.emit('getSkewerSimpleRay', simID, idx, [point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z])
     }
 }
 
 function downloadSkewerTable(d) {
 
     // var c = skewerData[0][0].lambda.map(function(e, i) {
     //     return [e, skewerData[0][0].flux[i]];
     // });
 
     c = JSON.stringify(d)
 
     let fn = 'skewer_info.txt'
     const a = document.createElement('a');
     const type = fn.split(".").pop();
     a.href = URL.createObjectURL(new Blob([c], { type: type }));
     a.download = fn;
     a.click();
 }
 
 skewer_attribute_matrix = []
 
 function createSkewerDataTexture(skewer_index, attr_data) {
     // //console.log(attr_data)
     size = attr_data.length
     d = new Uint8Array(3 * size)
 
     for (i = 0; i < size; i++) {
         band_col = attr_data[i].c
         stride = i * 3
 
         // low_col = new THREE.Color("rgb(18, 0, 153)")
         // high_col = new THREE.Color("rgb(200,200,200)")
 
         // band_col = low_col.lerp(high_col,attr_data[i].c)
         // //console.log(band_col)
         d[stride] = band_col * 255; // stores length along skewer (to be used as texture UV lookup)
         d[stride + 1] = band_col * 255; // stores attribute value at distance x
         d[stride + 2] = band_col * 255; // empty
         // color will be programmed in the shader based on these values since delta_x is not uniform
     }
     //console.log(d)
 
     skewerTexture[skewer_index] = new THREE.DataTexture(d, 1, size, THREE.RGBFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping,
         THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter)
     //console.log(skewer_index)
     skewerTexture[skewer_index].needsUpdate = true
     lines[skewer_index].material.uniforms.skewer_tex.value = skewerTexture[skewer_index]
     lines[skewer_index].material.uniformsNeedUpdate = true
     lines[skewer_index].material.uniforms.skewer_tex.needsUpdate = true
     lines[skewer_index].updateMatrix();
     lines[skewer_index].verticesNeedUpdate = true;
     lines[skewer_index].elementsNeedUpdate = true;
     lines[skewer_index].morphTargetsNeedUpdate = true;
     lines[skewer_index].uvsNeedUpdate = true;
     lines[skewer_index].normalsNeedUpdate = true;
     lines[skewer_index].colorsNeedUpdate = true;
     lines[skewer_index].tangentsNeedUpdate = true;
     lines[skewer_index].material.needsUpdate = true
 }
 
 function createColumnDensityInfoPanel(msg) {
     // this function creates the dropdown menu containing column density information along with accompanying graph
 
     idx = msg.index
 
 
     divID = 'simple-line-status-skewer-coords-' + idx + ''
     div = document.getElementById(divID)
 
     let dwnld_btn = document.createElement("button");
     dwnld_btn.className = 'download-skewer-button'
     dwnld_btn.innerHTML = "Download attributes";
     dwnld_btn.addEventListener("click", function () {
         downloadSkewerTable(msg)
     });
 
     dropdown_elements = ['temperature', 'density', 'entropy', 'metallicity', 'N(H I)', 'N(H II)', 'N(C I)', 'N(C II)', 'N(C III)', 'N(C IV)', 'N(C V)', 'N(C VI)', 'N(He I)', 'N(He II)', 'N(He III)', 'N(Mg I)', 'N(Mg II)', 'N(Mg X)', 'N(N II)', 'N(N III)', 'N(N IV)', 'N(N V)', 'N(N VI)', 'N(N VII)', 'N(Na I)', 'N(Na IX)', 'N(Ne III)', 'N(Ne IV)', 'N(Ne V)', 'N(Ne VI)', 'N(Ne VIII)', 'N(O I)', 'N(O II)', 'N(O III)', 'N(O IV)', 'N(O V)', 'N(O VI)', 'N(O VII)', 'N(O VIII)', 'N(S II)', 'N(S III)', 'N(S IV)', 'N(S V)', 'N(S VI)', 'N(Si II)', 'N(Si III)', 'N(Si IV)', 'N(Si XII)']
     // Lists for plotting (FH)
     // quanName = ['T', 'n_H', 'K', 'Z', 'v_los', 'N(H I)', 'N(H II)', 'N(C I)', 'N(C II)', 'N(C III)', 'N(C IV)', 'N(C V)', 'N(C VI)', 'N(He I)', 'N(He II)', 'N(He III)', 'N(Mg I)', 'N(Mg II)', 'N(Mg X)', 'N(N II)', 'N(N III)', 'N(N IV)', 'N(N V)', 'N(N VI)', 'N(N VII)', 'N(Na I)', 'N(Na IX)', 'N(Ne III)', 'N(Ne IV)', 'N(Ne V)', 'N(Ne VI)', 'N(Ne VIII)', 'N(O I)', 'N(O II)', 'N(O III)', 'N(O IV)', 'N(O V)', 'N(O VI)', 'N(O VII)', 'N(O VIII)', 'N(S II)', 'N(S III)', 'N(S IV)', 'N(S V)', 'N(S VI)', 'N(Si II)', 'N(Si III)', 'N(Si IV)', 'N(Si XII)']
     // unitName = ['K', 'cm^-3', 'keV cm^2', 'Zsun', 'km/s', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'N(N VII)', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2', 'cm^-2']
     // //
 
 
 
     // dropdown_elements = ['temperature', 'density', 'entropy', 'metallicity', 'LOS velocity', 'N(H I)', 'N(H II)', 'N(C I)', 'N(C II)', 'N(C III)', 'N(C IV)', 'N(C V)', 'N(C VI)', 'N(He I)', 'N(He II)', 'N(He III)', 'N(Mg I)', 'N(Mg II)', 'N(Mg X)', 'N(N II)', 'N(N III)', 'N(N IV)', 'N(N V)', 'N(N VI)', 'N(N VII)', 'N(Na I)', 'N(Na IX)', 'N(Ne III)', 'N(Ne IV)', 'N(Ne V)', 'N(Ne VI)', 'N(Ne VIII)', 'N(O I)', 'N(O II)', 'N(O III)', 'N(O IV)', 'N(O V)', 'N(O VI)', 'N(O VII)', 'N(O VIII)', 'N(S II)', 'N(S III)', 'N(S IV)', 'N(S V)', 'N(S VI)', 'N(Si II)', 'N(Si III)', 'N(Si IV)', 'N(Si XII)']
     var select = document.createElement("select")
     select.name = 'simple-line-results-' + idx + ''
     select.id = 'simple-line-results-' + idx + ''
     select.className = 'data_select'
 
     for (const el of dropdown_elements) {
         var option = document.createElement("option")
         option.value = el
         option.text = el
         select.appendChild(option)
     }
 
     var attributeSelectionDiv = document.createElement("div")
     attributeSelectionDiv.id = 'skewer-attribute-selection-' + idx + ''
     attributeSelectionDiv.className = 'skewer-attribute-selection'
 
     var label = document.createElement("label")
     label.innerHTML = "<div class='input-label'>Choose attribute:</div>"
     label.htmlfor = 'simple-line-results-' + idx + ''
 
     div.appendChild(attributeSelectionDiv).appendChild(label).appendChild(select)
     div.appendChild(dwnld_btn)
     var margin = { top: 10, right: 20, bottom: 30, left: 50 },
         width = 320 - margin.left - margin.right,
         height = 200 - margin.top - margin.bottom;
 
     s = document.getElementById('simple-line-results-' + idx + '')
     s.onchange = function () {
         // remove old plot
         // select = document.getElementById('col-density-graph-'+idx+'')
         s = document.getElementById('simple-line-results-' + msg.index + '')
         //console.log(msg)
         divID = 'simple-line-status-skewer-coords-' + msg.index + ''
         //console.log(divID)
         d3.select("#" + divID).selectAll(".graph").remove()
         d3.select("#" + divID).selectAll(".col-density-sum").remove()
 
         // make new plot
         data = []
         scaled_data = [] //will store scaled data between 0 and 1 for adding the skewer banding pattern
 
         skewer_attribute_matrix = msg[s.value]
 
         // print this above graph for just element column density
 
         if ((s.value).charAt(0) == 'N') {
 
             var predicate = (x) => x > 0;
             column_sum = round(Math.log10(skewer_attribute_matrix.filter(predicate).reduce((a, b) => a + b, 0)), 2)
             var sum_string = d3.select('#' + divID)
                 .append('text')
                 .attr("id", "col-density-sum-" + msg.index + '')
                 .attr("class", 'col-density-sum')
                 .text("Cum. log(" + s.value + "): " + column_sum);
         }
 
         if (s.value == 'metallicity') {
 
             // DATA FOR GRAPH
             min_l = d3.min(msg.l)
             max_l = d3.max(msg.l)
 
             var predicate = (x) => x > 0.00003;
             metal = msg[s.value].filter(predicate)
 
             min_val = Math.log10(d3.min(metal))
             max_val = Math.log10(d3.max(metal))
 
             c = 0
             for (i = 0; i < msg.l.length; i++) {
                 if (msg[s.value][i] > 0.00003) {
                     data[c] = { 'l': msg.l[i], 'c': Math.log10(msg[s.value][i]) }
                     c++
                 }
             }
 
             // INTERPOLATED DATA FOR SKEWERS
             i_min_l = d3.min(msg.i_l)
             i_max_l = d3.max(msg.i_l)
 
             i_metal = msg["i_" + s.value].filter(predicate)
 
             i_min_val = Math.log10(d3.min(i_metal))
             i_max_val = Math.log10(d3.max(i_metal))
 
             c = 0
             for (i = 0; i < msg.i_l.length; i++) {
                 if (msg["i_" + s.value][i] > 0.00003) {
                     scaled_data[c] = { 'l': (msg.i_l[i] - i_min_l) / (i_max_l - i_min_l), 'c': (Math.log10(msg["i_" + s.value][i]) - i_min_val) / (i_max_val - i_min_val) }
                     c++
                 }
             }
         }
 
         // ideally this should be more field agnostic... avoids wonky log10 scaling
         else if (s.value == 'density') {
 
             // DATA FOR GRAPH
             min_l = d3.min(msg.l)
             max_l = d3.max(msg.l)
             min_val = Math.log10(d3.min(msg[s.value]))
             max_val = Math.log10(d3.max(msg[s.value]))
 
             for (i = 0; i < msg.l.length; i++) {
                 data[i] = { 'l': msg.l[i], 'c': Math.log10(msg[s.value][i]) }
             }
 
             // INTERPOLATED DATA FOR SKEWERS
             i_min_l = d3.min(msg.i_l)
             i_max_l = d3.max(msg.i_l)
 
             i_min_val = Math.log10(d3.min(msg["i_" + s.value]))
             i_max_val = Math.log10(d3.max(msg["i_" + s.value]))
 
             for (i = 0; i < msg.i_l.length; i++) {
                 scaled_data[i] = { 'l': (msg.i_l[i] - i_min_l) / (i_max_l - i_min_l), 'c': (Math.log10(msg["i_" + s.value][i]) - i_min_val) / (i_max_val - i_min_val) }
             }
         } else {
 
             // DATA FOR GRAPH
             min_l = d3.min(msg.l)
             max_l = d3.max(msg.l)
 
             if (d3.min(msg[s.value]) <= 0) {
                 min_val = 0
             } else {
                 min_val = Math.log10(d3.min(msg[s.value]) + 1)
             }
 
             max_val = Math.log10(d3.max(msg[s.value]) + 1)
 
             for (i = 0; i < msg.l.length; i++) {
                 data[i] = { 'l': msg.l[i], 'c': Math.log10(msg[s.value][i] + 1) }
             }
 
             // INTERPOLATED DATA FOR SKEWERS
             i_min_l = d3.min(msg.i_l)
             i_max_l = d3.max(msg.i_l)
 
             if (d3.min(msg["i_" + s.value]) <= 0) {
                 i_min_val = 0
             } else {
                 i_min_val = Math.log10(d3.min(msg["i_" + s.value]) + 1)
             }
 
             i_max_val = Math.log10(d3.max(msg[s.value]) + 1)
 
             for (i = 0; i < msg.i_l.length; i++) {
                 scaled_data[i] = { 'l': (msg.i_l[i] - i_min_l) / (i_max_l - i_min_l), 'c': (Math.log10(msg["i_" + s.value][i] + 1) - i_min_val) / (i_max_val - i_min_val) }
             }
 
 
         }
 
         //console.log(min_l)
 
         createSkewerDataTexture(msg.index, scaled_data)
 
         // //console.log(scaled_data)
         var svg = d3.select('#' + divID)
             .append("svg")
             .attr("class", "graph col-density-graph")
             .attr("id", "col-density-graph-" + msg.index + '')
             .attr("width", width + margin.right)
             .attr("height", height + margin.top + margin.bottom)
             .append("g")
             .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 
         domainL = d3.extent(msg.l)
         var xScale = d3.scaleLinear()
             .range([0, width])
             .domain(domainL);
         svg.append("g")
             .attr("transform", "translate(0," + height + ")")
             .call(d3.axisBottom(xScale).ticks(6));
         svg.append("text")
             .attr('class', 'graph-labels')
             .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.top + 30) + ")")
             .style("text-anchor", "middle")
             .style("fill", "white")
             .text("Distance (kpc)")
 
         var yScale = d3.scaleLinear()
             .range([height, 0])
             .domain([min_val, max_val]);
         svg.append("g")
             .call(d3.axisLeft(yScale)
                 .tickFormat(d3.format("1")))
         svg.append("text")
             .attr('class', 'graph-labels')
             .attr("transform", "rotate(-90)")
             .attr("y", 0 - margin.left)
             .attr("x", 0 - (height / 2))
             .attr("dy", "0.9em")
             .style("text-anchor", "middle")
             .style("fill", "white")
             .text("log(" + s.value + ")");
         // if (s.value == 'LOS velocity') {
 
         //     var yScale = d3.scaleLinear()
         //         .range([height, 0])
         //         .domain([min_val, max_val]);
         //     svg.append("g")
         //         .call(d3.axisLeft(yScale)
         //             .tickFormat(d3.format("1")))
         //     svg.append("text")
         //         .attr('class', 'graph-labels')
         //         .attr("transform", "rotate(-90)")
         //         .attr("y", 0 - margin.left)
         //         .attr("x", 0 - (height / 2))
         //         .attr("dy", "0.9em")
         //         .style("text-anchor", "middle")
         //         .style("fill", "white")
 
         //         .text(quanName[s.selectedIndex] + "( " + unitName[s.selectedIndex] + " )")
         // }
         // else {
 
         //     var yScale = d3.scaleLinear()
         //         .range([height, 0])
         //         .domain([min_val, max_val]);
         //     svg.append("g")
         //         .call(d3.axisLeft(yScale)
         //             .tickFormat(d3.format("1")))
         //     svg.append("text")
         //         .attr('class', 'graph-labels')
         //         .attr("transform", "rotate(-90)")
         //         .attr("y", 0 - margin.left)
         //         .attr("x", 0 - (height / 2))
         //         .attr("dy", "0.9em")
         //         .style("text-anchor", "middle")
         //         .style("fill", "white")
         //         .text("log( " + quanName[s.selectedIndex] + " / " + unitName[s.selectedIndex] + " )")
 
         // }
 
         var line = d3.line()
             .x(d => xScale(d.l))
             .y(d => yScale(d.c))
         // console.log(line)    
         svg.append("path")
             .datum(data)
             .attr("class", "line")
             .attr("d", line)
 
     }
 
     s.value = 'temperature'
     min_l = d3.min(msg.l)
     max_l = d3.max(msg.l)
     min_val = Math.log10(d3.min(msg[s.value]) + 1)
     max_val = Math.log10(d3.max(msg[s.value]) + 1)
     //by defualt plot dist vs temp
     data = []
     scaled_data = []
     // var margin = {top: 10, right: 40, bottom: 30, left: 50},
     //     width = 300 - margin.left - margin.right,
     //     height = 200 - margin.top - margin.bottom;
 
     for (i = 0; i < msg.l.length; i++) {
         data[i] = { 'l': msg.l[i], 'c': Math.log10(msg.temperature[i] + 1) }
         scaled_data[i] = { 'l': (msg.l[i] - min_l) / (max_l - min_l), 'c': (Math.log10(msg[s.value][i] + 1) - min_val) / (max_val - min_val) }
     }
 
     createSkewerDataTexture(msg.index, scaled_data)
 
     var svg = d3.select('#' + divID)
         .append("svg")
         .attr("class", "graph")
         .attr("id", "col-density-graph-" + idx + '')
         .attr("width", width + margin.right)
         .attr("height", height + margin.top + margin.bottom)
         .append("g")
         .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 
     domainL = d3.extent(msg.l)
     var xScale = d3.scaleLinear()
         .range([0, width])
         .domain(domainL);
     svg.append("g")
         .attr("transform", "translate(0," + height + ")")
         .call(d3.axisBottom(xScale).ticks(6));
     svg.append("text")
         .attr('class', 'graph-labels')
         .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.top + 30) + ")")
         .style("text-anchor", "middle")
         .text("Distance (kpc)")
 
     var yScale = d3.scaleLinear()
         .range([height, 0])
         .domain([min_val, max_val]);
     svg.append("g")
         .call(d3.axisLeft(yScale));
     svg.append("text")
         .attr('class', 'graph-labels')
         .attr("transform", "rotate(-90)")
         .attr("y", 0 - margin.left)
         .attr("x", 0 - (height / 2))
         .attr("dy", "0.9em")
         .style("text-anchor", "middle")
         .text("log( Temperature (K) )");
 
     var line = d3.line()
         .x(d => xScale(d.l))
         .y(d => yScale(d.c))
 
     svg.append("path")
         .datum(data)
         .attr("class", "line")
         .attr("d", line)
 }
 
 function requestSpectrum(idx) {
     /**
      * * requestSpectrum() prepares and sends the coordinates of a skewer to the python backend for processing 
      * ? pt values are scaled since the voxelization process distorts the physical distances
      */
     skewers[idx].skewerStart = new Date()
     pt1 = scalePointCoords(skewers[idx].point1)
     pt2 = scalePointCoords(skewers[idx].point2)
 
     buttonId = 'request-button-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
 
     buttonId = 'p1-range-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
 
     buttonId = 'p2-range-' + idx + ''
     div = document.getElementById(buttonId)
     div.disabled = true
     sendLine(idx, pt1, pt2)
     div.innerText = 'requesting spectrum . . . '
 
     function scalePointCoords(pt) {
         x_scale = (edges_scaled.right_edge[0] - edges_scaled.left_edge[0]) / (edges.right_edge[0] - edges.left_edge[0])
         y_scale = (edges_scaled.right_edge[1] - edges_scaled.left_edge[1]) / (edges.right_edge[1] - edges.left_edge[1])
         z_scale = (edges_scaled.right_edge[2] - edges_scaled.left_edge[2]) / (edges.right_edge[2] - edges.left_edge[2])
         pt.x = pt.x / x_scale
         pt.y = pt.y / y_scale
         pt.z = pt.z / z_scale
         return pt
     }
 
     function sendLine(idx, point1, point2) {
         //console.log(point1, point2)
         socket.emit('selectRay', simID, idx, [point1.x, point1.y, point1.z], [point2.x, point2.y, point2.z])
     }
 }
 
 
 function plotSyntheticSpectrum(points) {
     /**
      * * plotSyntheticSpectrum() generates a new plot for the data it has received
      */
 
     data = []
     var margin = { top: 10, right: 30, bottom: 30, left: 30 },
         width = 300 - margin.left - margin.right,
         height = 200 - margin.top - margin.bottom;
     for (i = 0; i < points.lambda.length; i++) {
         data[i] = { 'lambda': points.lambda[i], 'flux': points.flux[i] }
     }
 
     skewers[points.index] = ({ 'point1': skewers[points.index].point1.clone(), 'point2': skewers[points.index].point2.clone(), 'lambda': points.lambda, 'flux': points.flux })
     // skewers[points.index] = ({ 'point1': { 'x': points.start[0], 'y': points.start[1], 'z': points.start[2] }, 'point2': { 'x': points.end[0], 'y': points.end[1], 'z': points.end[2] }, 'lambda': points.lambda, 'flux': points.flux })
     skewerData[points.index] = ([points, data])
     domainLambda = d3.extent(points.lambda)
     xScale = d3.scaleLinear()
         .range([0, width + margin.left + margin.right])
         .domain(domainLambda);
 
 
     updateGraph()
     createBrush()
 }
 
 /**
  * * SPECTRUM PLOTTING
  */
 
 function updateGraph() {
     var margin = { top: 10, right: 30, bottom: 30, left: 50 },
         width = 300 - margin.left - margin.right,
         height = 200 - margin.top - margin.bottom;
 
 
     let ele = document.getElementsByName('x-axis-transform')
     for (i = 0; i < ele.length; i++) {
         if (ele[i].checked) {
             ele = ele[i].value
         }
     }
 
     d3.select("#spectra-panel").selectAll(".graph").remove()
 
     if (skewerData.length) {
         for (i = 0; i < skewerData.length; i++) {
             if (skewerData[i]) {
                 let data = []
                 let idx = skewerData[i][0].index
                 x = Array.from(skewers[idx].lambda)
                 y = Array.from(skewers[idx].flux)
                 if (ele == "Angstroms" && (document.getElementById("common-wavelengths").value == "Select a rest wavelength (Å)" || document.getElementById("common-wavelengths").value == "full")) {
                     for (j = 0; j < x.length; j++) {
                         data[j] = { 'lambda': x[j], 'flux': y[j] }
                     }
                 } else if (ele == "Angstroms" && (document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)" && document.getElementById("common-wavelengths").value != "full")) {
                     for (j = 0; j < x.length; j++) {
                         data[j] = { 'lambda': x[j], 'flux': y[j] }
                     }
                 } else if (ele == "Velocity Space" && document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)") {
 
                     if (document.getElementById("common-wavelengths").value == "full") {
                         rest_lambda = (1450 + 1150) / 2
                     } else {
                         rest_lambda = parseFloat(document.getElementById("common-wavelengths").value)
                     }
 
                     let c = 3e5;
                     for (j = 0; j < x.length; j++) {
                         delta_lambda = x[j] - rest_lambda;
                         x[j] = (c * delta_lambda) / rest_lambda;
                     }
                     for (j = 0; j < x.length; j++) {
                         data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                     }
                 } else {
                     for (j = 0; j < x.length; j++) {
                         data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                     }
                 }
 
                 var svg = d3.select("#spectra-panel")
                     .append("svg")
                     .attr("class", "graph")
                     .attr("id", "graph-" + idx + '')
                     .attr("width", width + margin.right)
                     .attr("height", height + margin.top + margin.bottom)
                     .append("g")
                     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
 
                 svg.append("defs").append("clipPath")
                     .attr("id", "clip")
                     .append("rect")
                     .attr("width", width)
                     .attr("height", height);
                 svg.append("g")
                     // .attr('class', 'graph-labels')
                     .attr("transform", "translate(0," + height + ")")
                     .call(d3.axisBottom(xScale).ticks(6));
 
                 // text label for the x axis
 
                 if (ele == "Velocity Space") {
                     svg.append("text")
                         .attr('class', 'graph-labels')
                         .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.top + 30) + ")")
                         .style("text-anchor", "middle")
                         .text("V (km/s)")
                 } else {
                     svg.append("text")
                         .attr('class', 'graph-labels')
                         .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.top + 30) + ")")
                         .style("text-anchor", "middle")
                         .text("λ")
                 }
 
                 var yScale = d3.scaleLinear()
                     .range([height, 0])
                     .domain(d3.extent(skewers[idx].flux));
                 svg.append("g")
                     // .attr('class', 'graph-labels')
                     .call(d3.axisLeft(yScale));
 
                 // text label for the y axis
                 svg.append("text")
                     .attr('class', 'graph-labels')
                     .attr("transform", "rotate(-90)")
                     .attr("y", 0 - margin.left)
                     .attr("x", 0 - (height / 2))
                     .attr("dy", "0.9em")
                     .style("text-anchor", "middle")
                     .text("Flux");
 
                 var line = d3.line()
                     .x(d => xScale(d.lambda))
                     .y(d => yScale(d.flux))
 
                 svg.append("path")
                     .datum(data)
                     .attr("class", "line")
                     .attr("d", line)
 
                 svg.append("text")
                     .attr('class', 'graph-labels')
                     .attr("transform", "translate(-40,10)")
                     .text(idx)
 
 
                 if (lines[idx]) {
                     let id = "#graph-" + idx + ''
                     $(id).hover(function () {
 
                         lines[idx].material.color = new THREE.Color(0, 1, 0)
                     }, function () {
                         lines[idx].material.color = new THREE.Color(0xff5522)
                     });
                 }
 
             }
 
         }
 
     }
 }
 
 function createBrush() {
     // https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
     d3.select('#spectra-panel').selectAll('#depth-brush').remove();
     let svg = d3.select('#spectra-panel').append('div').attr('id', 'depth-brush').append('svg')
 
     let margin = { top: 10, right: 15, bottom: 30, left: 30 };
     let axis = svg.append('g');
 
     let brush = svg.append("g")
         .attr("class", "brush");
 
     let width = 300,
         height = 40
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
             .extent([
                 [margin.left, 0],
                 [width - margin.right, height]
             ])
             .on("brush end", brushed);
 
         brush.call(brusher)
             .call(brusher.move, x.range());
     }
 
     function brushed() {
         var s = d3.event.selection || x.range();
         ret = s.map(x.invert, x);
         // //console.log(s)
         // //console.log(ret)
         if (ret[0] !== ret[1]) {
 
             updateLambdaDomain(ret[0], ret[1])
             updateGraph()
 
         }
     }
 }
 
 function updateLambdaDomain(min, max) {
     if (min != undefined) {
         domainLambda[0] = min
     }
     if (max != undefined) {
         domainLambda[1] = max
     }
     xScale = d3.scaleLinear().domain(domainLambda).range([0, 210])
 }
 
 function commonWavelength() {
     let element = document.getElementsByName('x-axis-transform')
     let ele
     for (i = 0; i < element.length; i++) {
         if (element[i].checked) {
             ele = element[i].value
         }
     }
     if (document.getElementById("common-wavelengths").value == 'full') {
 
         updateLambdaDomain(1150, 1450)
 
         if (ele == "Velocity Space") {
             element[0].checked = true
         }
     } else {
         val = parseFloat(document.getElementById("common-wavelengths").value)
 
         if (ele == "Angstroms") {
             updateLambdaDomain(val - 5, val + 5)
             //console.log(domainLambda)
         } else if (ele == "Velocity Space") {
             updateLambdaDomain(-2000, 2000)
         }
     }
 
     updateGraph()
     createBrush()
 }
 
 
 
 function downloadSpectra() {
 
     var c = skewerData[0][0].lambda.map(function (e, i) {
         return [e, skewerData[0][0].flux[i]];
     });
 
     c = JSON.stringify(c)
 
     let fn = 'spectra.txt'
     const a = document.createElement('a');
     const type = fn.split(".").pop();
     a.href = URL.createObjectURL(new Blob([c], { type: type }));
     a.download = fn;
     a.click();
 }
 
 //DA request & receive plots from yt/python via socketio
 function requestYTPlots(galaxyID, rvir, center_coord_mpc, plot_type) {
     socket.emit('makePlots', simID, plot_type, galaxyID, center_coord_mpc, rvir, camera)
 }
 var image_data
 function receiveYTPlots(msg) {
     image_data = msg
     const image = document.createElement('img')
     //console.log(msg.image_url)
     image.src = msg.image_url
     document.getElementById('YTPlots').innerHTML = ''
     document.getElementById('YTPlots').appendChild(image)
 
     // var str = String.fromCharCode.apply(null, new Uint8Array(image_data.binary));
 
     // $('#YTPlots').append($('<img>')).attr('src','static/slice.png');
 }
 
 // FH galaxy brush history global object:
 var galaxyBrushHistory = {}
 
 //  .........FH create galaxy brush function.........
 async function createGalaxyFilteringBrushes(attr, field) {
 
     let selection = document.getElementById("sim_size_select")
 
     attrNoSpace = field.replaceAll(' ', '-')
 
     sim = selection.value
     //console.log('createGalaxyFilteringBrushes function', sim)
     d3.select('#galaxy-filter-criteria').append('div').attr('id', attrNoSpace + 'galaxy-brush-container').attr('class', 'galaxy-brush-container')
     d3.select('#' + attrNoSpace + 'galaxy-brush-container').append('div').attr('id', attrNoSpace + 'galaxy-brush-label').attr('class', 'galaxy-brush').append('text').text(attr)
     let svg = d3.select('#' + attrNoSpace + 'galaxy-brush-container').append('div').attr('id', attrNoSpace + 'galaxy-brush').attr('class', 'galaxy-brush').append('svg')
 
     var check = document.createElement("INPUT");
     check.setAttribute("type", "checkbox");
     document.getElementById(attrNoSpace + 'galaxy-brush-label').prepend(check)
 
 
     // checkState determines if checkbox is clicked
     check.addEventListener('change', e => {
         galaxyBrushHistory[attr].checkState = e.target.checked
         //         //console.log('new check', galaxyBrushHistory)
         // //console.log('new check 2',attr)
         filterGalaxies(sim)
     })
 
     // changing simulation changes the entire query
     // document.getElementById("sim_size_select").addEventListener('change', e => {
     //     //         //console.log('inside sim select event listener', sim)
     //     galIds_doc.innerText = ''
     //     haloIds_doc.innerText = ''
 
     //     for (const attr in galaxyBrushHistory) {
 
     //         const field = galaxyBrushHistory[attr].fieldName
 
     //         prop_doc = document.getElementById(field)
 
     //         prop_doc.innerText = ''
     //     }
     //     filterGalaxies(sim)
     // })
 
     let margin = { top: 20, right: 15, bottom: 30, left: 0 };
     let width = 300,
         height = 40
     let axis = svg.append('g');
     let brush = svg.append("g")
         .attr("class", "brush")
 
     let minAttrScale, maxAttrScale
 
     if (sim) {
 
         const data = await d3.json('static/data/RefL0100N1504/galaxies_RefL0100N1504.json')
         // let data = starGalaxyInfo
         if (data) {
 
             // console.log('eagle 100 data',data.length)
 
             // set the min and max:
             const data_length = data.length
             var max = 0
             var min = data[0][field]
             for (i = 0; i < data_length; i++) {
                 val = data[i][field]
                 max = val > max ? val : max
                 min = val < min ? val : min  // === 0 ? val : min_ms
             }
             minAttrScale = min === 0 ? 0.0001 : min  // to prevent undefined values
             // maxAttrScale = max
             // minAttrScale = min - 0.00001 === 0 ? 0.0001 : min  // to prevent undefined values
             minAttrScale = minAttrScale - 0.00001  // to ensure the minimum value is not omitted from queries
             maxAttrScale = max + 1  // to ensure the maximum value is not omitted from queries
         }
     }
 
     // console.log(minAttrScale,maxAttrScale,'these are the attr')
 
     var attrScale = d3.scaleLog()
         .domain([minAttrScale, maxAttrScale])
         .range([margin.left, width]);
 
     galaxyBrushHistory[attr] = {
         ranges: [minAttrScale, maxAttrScale], fieldName: field
     }
 
     galaxyBrushResize()
     drawGalaxyAttrBrush(attr)
 
     function galaxyBrushResize() {
         var w = width - margin.right;
         var h = 60;
 
         var aspect = w / h;
         var vw = width;
         var vh = vw / aspect;
 
         width = vw;
         height = vh - margin.bottom;
 
         svg
             .attr('width', w).attr('height', h)
             .attr("viewBox", "0 0 " + vw + " " + vh)
 
         attrScale.range([margin.left, width - margin.right]);
         axis.attr('transform', 'translate(0,' + height + ')')
             .call(d3.axisBottom(attrScale).ticks(6))
     }
 
     function drawGalaxyAttrBrush(attr) {
         if (!attr) { return; }
         galaxyAttrBrush = brush
         galaxyAttrBrusher = d3.brushX()
             .extent([
                 [margin.left, 0],
                 [width - margin.right, height]
             ])
             .on("brush end", galaxyAttrBrushed);
         galaxyAttrBrush.call(galaxyAttrBrusher)
             .call(galaxyAttrBrusher.move, attrScale.range());
     }
 
     function galaxyAttrBrushed() {
 
         // console.log('attrbrushed function')
 
         var s = d3.event.selection || attrScale.range();
 
         ret = s.map(attrScale.invert, attrScale);
 
         if (s) {
 
             galaxyBrushHistory[attr].ranges = ret.slice()
 
             // console.log('brush history',galaxyBrushHistory)
             filterGalaxies(sim)
         }
 
     }
 
     // console.log('brushessssss', galaxyBrushHistory[attr] )
 
 }
 
 var propList = {}
 
 // FH galaxy function #2 - actual querying in table:
 async function filterGalaxies(sim) {
 
     let selection = document.getElementById("sim_size_select")
 
     sim = selection.value
 
     //     allGalData_doc = document.getElementById('galdata')
     galIds_doc = document.getElementById('galid')
     haloIds_doc = document.getElementById('haloid')
 
     // const data = await d3.json('static/data/' + sim + '/galaxies_' + sim + '.json')
     let data = starGalaxyInfo
     // console.log('filterGalaxies function',sim,'static/data/' + sim + '/galaxies_' + sim + '.json')
 
     var filteredData = data.slice() //slice of data
 
     // console.log('new brush history',galaxyBrushHistory)
 
     ////////
 
     for (const attr in galaxyBrushHistory) {
 
         const range = galaxyBrushHistory[attr].ranges
         const field = galaxyBrushHistory[attr].fieldName
 
         var predicate = (x) => x[field] == 0 // find the 0 values
         // const getMax = (a, b) => Math.max(a[field], b[field]);
         // var f2 = filteredData.filter(predicate) 
 
         var replaceZero = (x) => { // finds and replaces the 0 values
             if (x[field] === 0) {
                 x[field] = 1.0e-4
             }
         }
 
         // // console.log('see now 1',f2)
         filteredData.map(replaceZero)
 
         // console.log(filteredData.length)
 
         // if (field == "sfr" || field == "mg") {
         //     var f2 = filteredData.filter(predicate) 
         //     // console.log('see now 1',f2)
         //     filteredData.map(replaceZero)
         // }
 
         // if (field == "sfr" || field == "mg") {
         //     var f2 = filteredData.filter(predicate) 
         //     console.log('see now 1',f2)
         //     // for (i = 0; i < f2.length; i++) {
         //     for (i = 0; i < filteredData.length; i++) {
 
         //         // var f3 = filteredData[i].filter(predicate)
         //         // console.log(f3)
         //         var val = filteredData[i][field]
         //         // var val = f2[i][field]
         //         if (val == 0) {
         //             // console.log('this is zero')
         //             val == 0.0001
         //         }
         //         // console.log(val)
         //     }
 
         //     var f3 = filteredData.filter(predicate) 
         //     console.log('see now 2',f3)
         //     // console.log('see now 2', filteredData)
         // }
 
         if (galaxyBrushHistory[attr].checkState == true) {
 
             var filteredData = filteredData.filter(d => d[field] >= range[0] && d[field] < range[1])
 
         }
     }
 
     // console.log('after filtering properly',filteredData)
 
     // var Fs = require['fs']
 
     // // /*
     // //  * Determine whether the given `path` points to an empty directory.
     // //  *
     // //  * @returns {Boolean}
     // //  */
     // async function isEmptyDir(path) {
     //     try {
     //         const directory = await Fs.opendir(path)
     //         const entry = await directory.read()
     //         await directory.close()
     //         return entry === null
     //     } catch (error) {
     //         return false
     //     }
     // }
     ///////
 
     for (const attr in galaxyBrushHistory) {
 
         // console.log(document.getElementById(field))
         propList[attr] = []
 
         if (galaxyBrushHistory[attr].checkState == true) {
 
             galIds_doc.innerText = ''  // clears any existing lists
             haloIds_doc.innerText = ''
 
             const range = galaxyBrushHistory[attr].ranges
             const field = galaxyBrushHistory[attr].fieldName
 
             prop_doc = document.getElementById(field)
             // console.log(prop_doc,galIds_doc)
             prop_doc.innerText = ''
 
             var filteredGalIds = filteredData.map(d => d.galID)
             var filteredHaloIds = filteredData.map(d => d.haloID)
             var filteredProps = filteredData.map(d => d[field])
 
             // propList.push(filteredProps)
 
             filteredProps.forEach(e => propList[attr].push(e));
 
             // propList[attr].push(filteredProps);
 
             // console.log('push thingy',propList[0])
 
             var filteredX = filteredData.map(d => d['gal_x'])
             var filteredY = filteredData.map(d => d['gal_y'])
             var filteredZ = filteredData.map(d => d['gal_z'])
             var filteredmh = filteredData.map(d => d['mh'])
             var filteredrh = filteredData.map(d => d['rh'])
             // var filteredngal = filteredData.map(d => d['num_gal']) 
 
 
             for (let i in filteredGalIds) {
 
                 let anchor = document.createElement("a");
                 anchor.href = "#";
                 anchor.innerText = parseFloat(filteredGalIds[i]);
 
                 let elem = document.createElement("li");
                 elem.appendChild(anchor);
                 galIds_doc.appendChild(elem);
 
                 // let anchor2 = document.createElement("a");
                 // anchor2.href = "#";
                 // anchor2.innerText = 'zoom'
 
                 // let elem2 = document.createElement("li");
                 // elem2.appendChild(anchor2);
                 // galIds_doc.appendChild(elem2);
 
                 // takes you to galaxy whose ID you click on:
                 anchor.addEventListener('click', (e) => {
                     dl = (filteredrh[i] / 1000) / (width_Mpc)  // half-width of virial halo in voxelized units
 
                     console.log('clicked on this galaxy: ID',
                         filteredGalIds[i], ' X', filteredX[i], ' Y', filteredY[i], ' Z', filteredZ[i])
 
                     asyncCall(true)  // this is so that we go back to the full view if we are currently zoomed in
                     updateSize(zoom_bool = false)  // this is so that we can change the grid resolution for the full view and not zoom-in
 
                     if (sim == "RefL0100N1504") {
                         goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 5 * (0.005 / dl))
                         // the last factor is to scale the width slightly by inverse of virial radius
 
                         /* if (filteredmh[i] >= 1.0e13) {
                              goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 5) }
                         
                         else if ((filteredmh[i] >= 1.0e12) && (filteredmh[i] < 1.0e13)) {
                                  goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 3) }
                         
                         else if (filteredmh[i] < 1.0e12) {
                                      goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 2) }
                         */
                     }
                     else if (sim == "RefL0025N0376") {
                         goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 3)
                     }
                     else { goToPoint(filteredX[i], filteredY[i], filteredZ[i], dl * 3) }
 
                     //////////////////
                     // center_coord_mpc = [filteredX[i], filteredY[i], filteredZ[i]]
                     // rvir = filteredrh[i] / 1000
                     // galaxyID = filteredGalIds[i]
                     // plot_type = "2D_phase"
                     // plot_type = "slice"
                     // requestYTPlots(galaxyID,rvir,center_coord_mpc,plot_type)
                     // ytPlotOptions(galaxyID,rvir,center_coord_mpc)
                     ///////////////
 
                 })
 
             }
 
             for (let i in filteredHaloIds) {
 
                 // var elem = document.createElement("li");
                 // elem.innerText = parseFloat(filteredHaloIds[i])
                 // haloIds_doc.appendChild(elem);
 
                 // let path = 'static/data/' + sim + '/Halos/halo_' + filteredHaloIds[i] + '/PartType0/'
 
                 // var isItEmpty = isEmptyDir(path)
 
                 // console.log(isItEmpty)
 
                 let anchor = document.createElement("a");
                 anchor.href = "#";
                 anchor.innerText = parseFloat(filteredHaloIds[i]);
 
                 let elem = document.createElement("li");
                 elem.appendChild(anchor);
                 haloIds_doc.appendChild(elem);
 
                 // var path = 'static/data/' + sim + '/Halos/halo_' + filteredHaloIds[i] + '/simMetadata.json'
                 // var haloFile = new File([""],path)
 
                 // // See if the file exists
                 // if(haloFile.exists()) {
                 //     console.log('EXISTS!')
                 // }
                 // else {
                 //     console.log('DOESNT EXIST!')
 
                 // }
 
                 anchor.addEventListener('click', (e) => {
                     // let btn = document.createElement("button");
                     // btn.innerHTML = "Save";
 
                     console.log('Zoom-in resampling: Halo ID ', filteredHaloIds[i],
                         ", virial radius ", filteredrh[i], " kpc")
 
                     // camera.zoom = 1.0
                     // camera.updateProjectionMatrix()
 
                     goToPoint(width_Mpc / 2, width_Mpc / 2, width_Mpc / 2, 0.5)
                     camera.zoom = 1.0
                     camera.updateProjectionMatrix()
                     // updateUniforms() 
 
                     asyncZoom(true, halos = filteredHaloIds[i])
 
                     updateSize(zoom_bool = true, halos = filteredHaloIds[i])
 
                     // zoom_bool == false
                     // console.log('what about here', zoom_bool,halos)
 
                     // loadZoomIn(simSize, attr, filteredHaloIds[i])
                     // btn.addEventListener("click", function () {
                     // console.log('Button here')
                     // })
 
                 })
             }
 
             for (let i in filteredProps) {
 
                 var elem = document.createElement("li");
 
                 if (field == "num_gal") {  //just integers to be displayed for the number of galaxies field
                     elem.innerText = Number.parseInt(filteredProps[i]);
                 }
                 else {  //scientific notation to 3 sig figs for the rest
                     elem.innerText = Number.parseFloat(filteredProps[i]).toPrecision(3);
                 }
                 prop_doc.appendChild(elem);
             }
 
         }
 
         // plotProps(propList)
     }
 
 }
 
 
 function createXYZBrush(xyz) {
     // https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js 
     d3.select('#navigation').append('div').attr('id', xyz + '-depth-brush-label').attr('class', 'depth-brush').append('text').text(xyz)
     let svg = d3.select('#navigation').append('div').attr('id', xyz + '-depth-brush').attr('class', 'depth-brush').append('svg')
 
     let margin = { top: 20, right: 15, bottom: 30, left: 20 };
     let width = 343,
         height = 40
 
     let axis = svg.append('g');
 
     let brush = svg.append("g")
         .attr("class", "brush")
 
     var x = d3.scaleLinear()
         .domain([0.0, 1.0])
         // .domain([edges.left_edge[0],edges.right_edge[0]])
         .range([margin.left, width]);
 
     var y = d3.scaleLinear()
         .domain([0.0, 1.0])
         // .domain([edges.left_edge[1],edges.right_edge[1]])
         .range([margin.left, width]);
 
     var z = d3.scaleLinear()
         .domain([0.0, 1.0])
         // .domain([edges.left_edge[2],edges.right_edge[2]])
         .range([margin.left, width]);
 
     // simID = document.getElementById("sim_size_select").value
 
     // let edge = []
 
     // var e2 = edges.slice() //slice of data
 
 
     // d3.json('static/data/' + simID + '/simMetadata.json').then(function(d) {
     //     edges.left_edge = d.left_edge
     //     edges.right_edge = d.right_edge
     //     resolve()
     // }) 
 
 
     // console.log('XYZBrush', edges)    
 
     XYZresize();
     drawXYZBrush(xyz);
 
     function XYZresize() {
         var w = width - margin.right;
         var h = 60;
 
         var aspect = w / h;
         var vw = width;
         var vh = vw / aspect;
 
         width = vw;
         height = vh - margin.bottom;
 
         svg
             .attr('width', w).attr('height', h)
             .attr("viewBox", "0 0 " + vw + " " + vh)
 
         x.range([margin.left, width - margin.right]);
         axis.attr('transform', 'translate(0,' + height + ')')
             .call(d3.axisBottom(x).ticks(12))
 
         y.range([margin.left, width - margin.right]);
         axis.attr('transform', 'translate(0,' + height + ')')
             .call(d3.axisBottom(y).ticks(12))
 
         z.range([margin.left, width - margin.right]);
         axis.attr('transform', 'translate(0,' + height + ')')
             .call(d3.axisBottom(z).ticks(12))
 
     }
 
     function drawXYZBrush(xyz) {
         if (xyz == 'x') {
             if (!x) { return; }
             xBrush = brush
             xBrusher = d3.brushX()
                 .extent([
                     [margin.left, 0],
                     [width - margin.right, height]
                 ])
                 .on("brush end", XYZbrushed);
             xBrush.call(xBrusher)
                 .call(xBrusher.move, x.range());
         } else if (xyz == 'y') {
             if (!y) { return; }
             yBrush = brush
             yBrusher = d3.brushX()
                 .extent([
                     [margin.left, 0],
                     [width - margin.right, height]
                 ])
                 .on("brush end", XYZbrushed);
             yBrush.call(yBrusher)
                 .call(yBrusher.move, y.range());
         } else if (xyz == 'z') {
             if (!z) { return; }
             zBrush = brush
             zBrusher = d3.brushX()
                 .extent([
                     [margin.left, 0],
                     [width - margin.right, height]
                 ])
                 .on("brush end", XYZbrushed);
             zBrush.call(zBrusher)
                 .call(zBrusher.move, z.range());
         }
     }
 
     function XYZbrushed() {
 
         if (xyz == 'x') {
             var s = d3.event.selection || x.range();
             ret = s.map(x.invert, x);
         } else if (xyz == 'y') {
             var s = d3.event.selection || y.range();
             ret = s.map(y.invert, y);
         } else if (xyz == 'z') {
             var s = d3.event.selection || z.range();
             ret = s.map(z.invert, z);
         }
         if (ret[0] !== ret[1]) {
             updateXYZDomain(xyz, ret[0], ret[1])
         }
     }
 }
 
 function updateXYZDomain(xyz, min, max) {
     controls.target.set(((domainXYZ[1] + domainXYZ[0]) * gridsize) / 2, ((domainXYZ[3] + domainXYZ[2]) * gridsize) / 2, ((domainXYZ[5] + domainXYZ[4]) * gridsize) / 2);
     controls.update()
     if (xyz == 'x') {
         domainXYZ[0] = min
         domainXYZ[1] = max
     } else if (xyz == 'y') {
         domainXYZ[2] = min
         domainXYZ[3] = max
     } else if (xyz == 'z') {
         domainXYZ[4] = min
         domainXYZ[5] = max
     }
     createSkewerCube(gridsize)
     updateUniforms();
     xSliderScale = d3.scaleLinear().domain([domainXYZ[0], domainXYZ[1]]).range([0, 210])
     ySliderScale = d3.scaleLinear().domain([domainXYZ[2], domainXYZ[3]]).range([0, 210])
     zSliderScale = d3.scaleLinear().domain([domainXYZ[4], domainXYZ[5]]).range([0, 210])
 }
 
 
 
 function checkSelectedSimID() {
     let selection = document.getElementById("sim_size_select")
 
     oldSimID = simID
 
     simID = selection.value
 
     if (oldSimID != simID) {
         d3.json('static/data/' + simID + '/simMetadata.json').then(function (d) {
             edges.left_edge = d.left_edge
             edges.right_edge = d.right_edge
             width_Mpc = (edges.right_edge[0] - edges.left_edge[0])
 
             // console.log('edges',edges)
 
             field_list = d.field_list
             createAttributeSelectors(field_list)
             simSize = (edges.right_edge[0] - edges.left_edge[0]) //0.6776999078
             toggleGrid()
             updateUniforms()
             asyncCall(false)
 
         })
         clearDropDowns()
 
 
         function clearDropDowns() {
             $("#gas_select").empty();
             $("#dm_select").empty();
             $("#star_select").empty();
             $("#bh_select").empty();
         }
 
         // FH - changing simulation changes the entire galaxy query:
         galIds_doc = document.getElementById('galid')
         haloIds_doc = document.getElementById('haloid')
         galIds_doc.innerText = ''
         haloIds_doc.innerText = ''
 
         for (const attr in galaxyBrushHistory) {
 
             const field = galaxyBrushHistory[attr].fieldName
 
             prop_doc = document.getElementById(field)
 
             prop_doc.innerText = ''
 
         }
 
         filterGalaxies(simID)
     }
 
     function createAttributeSelectors(field_list) {
         var select = document.getElementById("gas_select");
         var option = document.createElement("option");
         option.disabled = "disabled"
         option.selected = "selected"
         option.text = "Select an attribute"
         select.add(option);
 
         var select = document.getElementById("bh_select");
         var option = document.createElement("option");
         option.disabled = "disabled"
         option.selected = "selected"
         option.text = "Select an attribute"
         select.add(option);
 
         for (i = 0; i < field_list.length; i++) {
             if (field_list[i][0] == 'PartType0') {
                 if (field_list[i][0] == 'PartType0') {
                     //console.log(field_list[i])
                     if ((field_list[i][1] == 'Temperature') ||
                         (field_list[i][1] == 'Entropy') ||
                         (field_list[i][1] == 'Metallicity') ||
                         (field_list[i][1] == 'Density') ||
                         // (field_list[i][1] == 'Pressure') ||
                         (field_list[i][1] == 'pressure') ||
                         // (field_list[i][1] == 'Mach_number') ||
                         (field_list[i][1] == 'Machnumber') ||
                         (field_list[i][1] == 'tcool_tff') ||
                         (field_list[i][1] == 'xray_luminosity_0.1_2_keV')
                         // these feel pretty useless to me: 
                         // (field_list[i][1] == 'Carbon') ||
                         // (field_list[i][1] == 'Oxygen')
                     ) {
                         var select = document.getElementById("gas_select");
                         var option = document.createElement("option");
                         option.text = field_list[i][1];
                         select.add(option);
                     } else if (simID == "TNG100_z2.3") {
                         var select = document.getElementById("gas_select");
                         var option = document.createElement("option");
                         option.text = field_list[i][1];
                         select.add(option);
                     }
                 }
             }
             // if(field_list[i][0] == 'PartType1'){
             //     var select = document.getElementById("dm_select"); 
             //     var option = document.createElement("option");
             //     option.text = field_list[i][1];
             //     select.add(option);
             // }
             // if(field_list[i][0] == 'PartType4'){
             //     var select = document.getElementById("star_select"); 
             //     var option = document.createElement("option");
             //     option.text = field_list[i][1];
             //     select.add(option);
             // }
             if (field_list[i][0] == 'PartType5') {
                 var select = document.getElementById("bh_select");
                 var option = document.createElement("option");
                 option.text = field_list[i][1];
                 select.add(option);
             }
         }
         // sendSimIDtoServer(simID)
 
     }
 
     function sendSimIDtoServer(simID) {
         socket.emit('simIDtoServer', simID)
     }
 }
 
 function getDate() {
     var objToday = new Date(),
         weekday = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
         dayOfWeek = weekday[objToday.getDay()],
         domEnder = function () { var a = objToday; if (/1/.test(parseInt((a + "").charAt(0)))) return "th"; a = parseInt((a + "").charAt(1)); return 1 == a ? "st" : 2 == a ? "nd" : 3 == a ? "rd" : "th" }(),
         dayOfMonth = today + (objToday.getDate() < 10) ? '0' + objToday.getDate() + domEnder : objToday.getDate() + domEnder,
         months = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
         curMonth = months[objToday.getMonth()],
         curYear = objToday.getFullYear(),
         curHour = objToday.getHours() > 12 ? objToday.getHours() - 12 : (objToday.getHours() < 10 ? "0" + objToday.getHours() : objToday.getHours()),
         curMinute = objToday.getMinutes() < 10 ? "0" + objToday.getMinutes() : objToday.getMinutes(),
         curSeconds = objToday.getSeconds() < 10 ? "0" + objToday.getSeconds() : objToday.getSeconds(),
         curMeridiem = objToday.getHours() > 12 ? "PM" : "AM";
     var today = curHour + ":" + curMinute + "." + curSeconds + curMeridiem + " " + dayOfWeek + " " + dayOfMonth + " of " + curMonth + ", " + curYear;
     return objToday
 }
 
 function checkMobile() {
     var isMobile = false; //initiate as false
     // device detection
     if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
         || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0, 4))) {
         isMobile = true;
     }
     return isMobile;
 }
 
 var logs = []
 // PREFERRED METHOD FOR LOGGING -- CONSOLE.LOG() BAD
 function write2Log(msg, lvl, cmnt, tag) {
     // msg == can be any variable type, ideally a string for readability.
     // lvl == log level [ 0 DEBUG, 1 ERROR, 2 INFO, 3 WARN ]
     // cmnt == any string comment to go along with the message
     // tag == a string, or list of strings, describing the context for the error. (ex: [ skewer, ui ] )
 
     // push message to global 'logs' variable along with some metadata
     logs.header = ['message', 'log_level', 'comments', 'tags', 'simID', 'grid_size', 'timestamp', 'browser_info', 'isMobile?']
     logs.push(
         [msg, lvl, cmnt, tag, simID, gridsize, getDate(), navigator, checkMobile()]
     )
 
     // print to console based on set Logger.level. Default is off
     if (lvl == 0 || lvl == 'DEBUG') {
         Logger.trace(msg)
     }
     else if (lvl == 1 || lvl == 'ERROR') {
         Logger.error(msg)
     }
     else if (lvl == 2 || lvl == 'INFO') {
         Logger.info(msg)
     }
     else if (lvl == 3 || lvl == 'WARN') {
         Logger.warn(msg)
     }
 }
 
 // send logs to Flask server when user navigates away from screen
 document.addEventListener('visibilitychange', function () {
     write2Log('send log to server', 'INFO', null, 'log')
     console.log(logs)
     if (document.visibilityState == 'hidden') {
         socket.emit("js_logs", { 'log': JSON.stringify(logs), 'header': JSON.stringify(logs.header) });
     }
 });
 
 function init() {
     // simID = 'RefL0012N0188'
     Logger.useDefaults()
     // https://github.com/jonnyreeves/js-logger
     Logger.setLevel(Logger.OFF) // other options: Logger.WARN, Logger.TRACE, Logger.DEBUG
     write2Log("initializing environment")
     checkSelectedSimID()
     THREE.Cache.enabled = true
     canvas = document.createElement('canvas')
     canvas.id = 'webglcanvas'
     var devicePixelRatio = window.devicePixelRatio || 1;
     canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
     canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
     context = canvas.getContext('webgl2', { antialias: true, alpha: true })
 
     scene = new THREE.Scene();
     scene.background = new THREE.Color("rgb(4,6,23)")
 
     // camera = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 0.0001, 10000 );
     camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
 
     camera.layers.enable(0);
     camera.layers.enable(1);
     camera.layers.enable(2);
     camera.layers.enable(3);
     camera.layers.enable(4);
     camera.layers.enable(9);
     camera.layers.enable(10);
 
     renderer = new THREE.WebGLRenderer({ canvas: canvas, context: context });
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setPixelRatio(1);
 
     renderer.antialias = true;
     renderer.precision = 'highp';
     renderer.powerPreference = 'high-performance'
     renderer.sortPoints = true;
     renderer.gammaFactor = 4.2;
     renderer.outputEncoding = THREE.sRGBEncoding;
     renderer.logarithmicDepthBuffer = true
     renderer.localClippingEnabled = true;
 
     // renderer.context.canvas.addEventListener("webglcontextlost", function(event) {
     //     event.preventDefault();
     //     // animationID would have been set by your call to requestAnimationFrame
     //     // cancelAnimationFrame(animationID); 
     // }, false);
 
     // renderer.context.canvas.addEventListener("webglcontextrestored", function(event) {
     //    init()
     // }, false);
     document.body.appendChild(renderer.domElement);
 
     setupRenderTarget()
     // controls = new THREE.OrbitControls(camera, renderer.domElement);
     controls = new THREE.TrackballControls(camera, renderer.domElement);
     camera.position.set(gridsize * 2, gridsize * 2, gridsize * 2)
     camera.lookAt(gridsize / 2, gridsize / 2, gridsize / 2)
     camera.zoom = 1.0
     camera.updateProjectionMatrix();
     controls.target.set(gridsize / 2, gridsize / 2, gridsize / 2);
     controls.noRotate = false
     controls.noZoom = true
     controls.rotateSpeed = 10.0;
     controls.zoomSpeed = 1.0;
     controls.panSpeed = 5.0;
     controls.staticMoving = true
     controls.dynamicDampingFactor = 0.5
     // controls.keys
     // controls.enableDamping = true
     // controls.panSpeed = 0.1
     controls.rotateSpeed = 4;
     controls.dampingFactor = 1;
     controls.addEventListener('change', requestRenderIfNotRequested)
     controls.enableKeys = true
     controls.update()
     initColor();
 
     window.addEventListener('wheel', function (e) {
         // e.preventDefault();
         // //console.log(e)
         //scrolling
         if (!container_hover) {
             camera.zoom -= e.deltaY / 1000
             if (camera.zoom <= 0) {
                 camera.zoom = 0.5
             }
         }
         updateCameraNearAndFar()
         // var x = ( event.clientX / window.innerWidth ) * 2 - 1,
         // y = - ( event.clientY / window.innerHeight ) * 2 + 1,
         // vector = new THREE.Vector3(x, y, 1),
         // factor = 0.5,
         // func = e.deltaY < 0 ? 'addVectors' : 'subVectors';
         // vector.unproject(camera);
         // vector.sub(camera.position);
         // camera.position[func](camera.position,vector.setLength(factor));
         // controls.target[func](controls.target,vector.setLength(factor));
         camera.updateProjectionMatrix();
     })
 
     // document.onkeydown = onKeyDown
     document.addEventListener('keyup', onKeyUp, false)
     document.addEventListener('keydown', onKeyDown, false)
     window.addEventListener('resize', onWindowResize, false);
     document.addEventListener('mousemove', onMouseMove, false);
 
     document.addEventListener('click', onMouseClick, false);
     document.addEventListener('wheel', onMouseWheel, false);
 
     gmc = document.querySelector("#gasMinCol")
     gmc.addEventListener('change', changeColor, false);
     gmd = document.querySelector("#gasMidCol")
     gmd.addEventListener('change', changeColor, false);
     gmxc = document.querySelector("#gasMaxCol")
     gmxc.addEventListener('change', changeColor, false);
 
     dmc = document.querySelector("#dmMinCol")
     dmc.addEventListener('change', changeColor, false);
     dmxc = document.querySelector("#dmMaxCol")
     dmxc.addEventListener('change', changeColor, false);
 
     // smc = document.querySelector("#starCol")
     // smc.addEventListener('change',changeColor,false);
     smc = document.querySelector("#starMinCol")
     smc.addEventListener('change', changeColor, false);
     smxc = document.querySelector("#starMaxCol")
     smxc.addEventListener('change', changeColor, false);
 
     // bmc = document.querySelector("#bhMinCol")
     // bmc.addEventListener('change', changeColor, false);
     // bmxc = document.querySelector("#bhMaxCol")
     // bmxc.addEventListener('change', changeColor, false);
 
     createXYZBrush('x')
     createXYZBrush('y')
     createXYZBrush('z')
 
     toggleGrid()
 
     camPos = camera.position
 
 
 
     createGalaxyFilteringBrushes('halo mass', 'mh')
     createGalaxyFilteringBrushes('stellar mass', 'ms')
     createGalaxyFilteringBrushes('star formation rate', 'sfr')
     createGalaxyFilteringBrushes('gas mass', 'mg')
     createGalaxyFilteringBrushes('black hole mass', 'mbh')
     createGalaxyFilteringBrushes('M*>10^8 galaxies in halo', 'num_gal')
 
 
     x = document.getElementById('x-depth-brush')
     x.addEventListener('change', updateUniforms, false)
     y = document.getElementById('x-depth-brush')
     y.addEventListener('change', updateUniforms, false)
     z = document.getElementById('x-depth-brush')
     z.addEventListener('change', updateUniforms, false)
 
     changeSkewerColor()
 
 }
 
 function onMouseMove(event) {
     /**
      * * onMouseMove() is an event listener for when the mouse position changes
      */
     // mouse.x = ( event.clientX - windowHalf.x );
     // mouse.y = ( event.clientY - windowHalf.x );
     mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
     mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
     updateCameraNearAndFar()
 
     starCaster()
 
 }
 
 function onMouseClick(event) {
     /**
      * * onMouseClick() is an event listener for when the mouse is clicked. Mainly used for drawing skewers
      */
 
     //get mouse coordinates in screen space
     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
 
     //find start and end points on mouse click when drawSkewers is true
     if (drawSkewers && !container_hover) {
         //this uses the position of the camera and the location of the mouse press
         //in order to generate a point in the space that passes from the camera through the mouse position
         planeNormal.copy(camera.position).normalize();
         plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
         raycaster.setFromCamera(mouse, camera);
         raycaster.ray.intersectPlane(plane, point);
         var geometry = new THREE.BufferGeometry();
         ray1 = new THREE.Vector3(point.x, point.y, point.z)
         cd = new THREE.Vector3()
         camera.getWorldDirection(cd)
         var intersects = raycaster.intersectObject(object = cube, recursive = true)
         //check to see if the mouse click intersects with invisible cube around the data
         points = []
         if (raycaster.intersectObject(cube).length > 0) {
 
             for (i = 0; i < intersects.length; i++) {
                 points[i] = intersects[i].point
             }
             //runs algorithm that finds two end points on surface of the cube
             // findLineEnds(ray1,cd)    
         }
 
         dir = new THREE.Vector3(points[1].x - points[0].x, points[1].y - points[0].y, points[1].z - points[0].z)
         dir.normalize()
 
         if (points[0].x < domainXYZ[0] * gridsize) points[0].x = domainXYZ[0] * gridsize
         if (points[0].y < domainXYZ[2] * gridsize) points[0].y = domainXYZ[2] * gridsize
         if (points[0].z < domainXYZ[4] * gridsize) points[0].z = domainXYZ[4] * gridsize
         if (points[0].x > domainXYZ[1] * gridsize) points[0].x = domainXYZ[1] * gridsize
         if (points[0].y > domainXYZ[3] * gridsize) points[0].y = domainXYZ[3] * gridsize
         if (points[0].z > domainXYZ[5] * gridsize) points[0].z = domainXYZ[5] * gridsize
         if (points[1].x < domainXYZ[0] * gridsize) points[1].x = domainXYZ[0] * gridsize
         if (points[1].y < domainXYZ[2] * gridsize) points[1].y = domainXYZ[2] * gridsize
         if (points[1].z < domainXYZ[4] * gridsize) points[1].z = domainXYZ[4] * gridsize
         if (points[1].x > domainXYZ[1] * gridsize) points[1].x = domainXYZ[1] * gridsize
         if (points[1].y > domainXYZ[3] * gridsize) points[1].y = domainXYZ[3] * gridsize
         if (points[1].z > domainXYZ[5] * gridsize) points[1].z = domainXYZ[5] * gridsize
         // console.log(points[0],points[1])
 
         // printLine(point1,point2)...
         // //console.log('2/2')
 
         // //console.log(dir)
         handleLine(dir, points[0], points[1])
         // printLine(dir,point1,point2)
     }
 
     function handleLine(dir, point1, point2) {
         /**
          * * handleLine() sends the line data to several destinations, to be drawn, saved, etc
          */
 
         idx = skewers.length
         updateSkewerList(dir, idx, point1, point2)
         saveLine(idx, point1, point2)
         // sendLine(idx,point1,point2)
         printLine(idx, point1, point2)
     }
 
     function printLine(idx, point1, point2) {
         /**
          * * printLine() draws the skewer in the scene
          */
 
 
         skewerScene.remove(lines[idx])
 
         skewerGeometry = cylinderMesh(point1, point2)
         skewerGeometry.DefaultUp = new THREE.Vector3(0, 0, 1);
 
         skewerGeometry.updateMatrix();
         skewerGeometry.verticesNeedUpdate = true;
         skewerGeometry.elementsNeedUpdate = true;
         skewerGeometry.morphTargetsNeedUpdate = true;
         skewerGeometry.uvsNeedUpdate = true;
         skewerGeometry.normalsNeedUpdate = true;
         skewerGeometry.colorsNeedUpdate = true;
         skewerGeometry.tangentsNeedUpdate = true;
 
         // //console.log(skewerGeometry)
         // render()
 
 
         // lines[idx] = new THREE.Line2( geometry, material );
         lines[idx] = skewerGeometry
 
         lines[idx].layers.set(4)
         skewerScene.add(lines[idx]);
     }
 
 
 
     function updateSkewerList(dir, idx, point1, point2) {
 
         /**
          * * updateSkewerList() updates the skewer container UI for the corresponding line
          */
 
         dist = Math.sqrt(Math.pow((point1.x - point2.x), 2) + Math.pow((point1.y - point2.y), 2) + Math.pow((point1.z - point2.z), 2))
         //create div to hold skewer details
         div = document.getElementById('skewer-coords')
         id = 'skewer-coords-' + idx
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords" id="' + id + '"></div>');
 
         // $("#" + id).hover(function(){
         //     lines[idx].material.color = new THREE.Color(1,0,1)
         //     lines[idx].material.needsUpdate = true
         //     }, function(){
         //         lines[idx].material.color = new THREE.Color(0xffff00)
         //         lines[idx].material.needsUpdate = true
         // });
 
         //create div to show the line idx
         div = document.getElementById(id)
         id = 'skewer-coords-number-' + idx
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-number" id=' + id + '>' + idx + ' <img id="delete-icon-"' + idx + '" class="delete-icon" src="static/assets/delete.svg" alt="delete line" role="button" onclick="deleteLine(' + idx + ')"  /> <img id="retry-icon-"' + idx + '" class="retry-icon" src="static/assets/refresh.svg" alt="retry line" role="button" onclick="retryLine(' + idx + ')"  /> </div>')
         //create div to show pt1 details and range slider
         id = 'skewer-coords-' + idx
         div = document.getElementById(id)
         id = 'skewer-coords-pt1-range-' + idx + ''
         id_range = "p1-range-" + idx + ''
         // div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt1-range" id=' + id + '>point 1:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0" onChange="updateUniforms()"></div></div>')
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt1-range" id=' + id + '>point 1:</div>')
         div = document.getElementById(id)
 
         id = "skewer-coords-point1-" + idx + ''
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(point1.x * (edges.right_edge[0] / gridsize), 3) + ', ' + round(point1.y * (edges.right_edge[1] / gridsize), 3) + ', ' + round(point1.z * (edges.right_edge[0] / gridsize), 3) + ' ) Mpc </div>')
 
         div.insertAdjacentHTML('beforeend', '<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0" onChange="updateUniforms()"></div>')
 
         //create div to show pt2 details and range slider
         id = 'skewer-coords-' + idx
         div = document.getElementById(id)
         id = 'skewer-coords-pt2-range-' + idx + ''
         id_range = "p2-range-" + idx + ''
         // div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt2-range" id="' + id + '">point 2:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0" onChange="updateUniforms()"></div></div>')
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt2-range" id="' + id + '">point 2:</div>')
 
         div = document.getElementById(id)
         id = "skewer-coords-point2-" + idx + ''
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-values" id="' + id + '">( ' + round(point2.x * (edges.right_edge[0] / gridsize), 3) + ', ' + round(point2.y * (edges.right_edge[1] / gridsize), 3) + ', ' + round(point2.z * (edges.right_edge[0] / gridsize), 3) + ' ) Mpc </div>')
         div.insertAdjacentHTML('beforeend', '<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0" onChange="updateUniforms()"></div>')
 
         //create event listeners for the range sliders
         p1slider = document.getElementById('p1-range-' + idx + '')
         p1slider.oninput = function () {
             slider = document.getElementById('p1-range-' + idx + '')
             pt1 = []
             pt1.x = point1.x - slider.value * dir.x * (-1)
             pt1.y = point1.y - slider.value * dir.y * (-1)
             pt1.z = point1.z - slider.value * dir.z * (-1)
 
             slider = document.getElementById('p2-range-' + idx + '')
             pt2 = []
             pt2.x = point2.x + slider.value * dir.x * (-1)
             pt2.y = point2.y + slider.value * dir.y * (-1)
             pt2.z = point2.z + slider.value * dir.z * (-1)
 
             id = "skewer-coords-point1-" + idx + ''
             div = document.getElementById(id)
             div.innerHTML = ''
             div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt1.x * (edges.right_edge[0] / gridsize), 3) + ', ' + round(pt1.y * (edges.right_edge[1] / gridsize), 3) + ', ' + round(pt1.z * (edges.right_edge[0] / gridsize), 3) + ' ) Mpc </div>')
             printLine(idx, pt1, pt2)
             saveLine(idx, pt1, pt2)
         }
 
         //create event listeners for the range sliders
         p2slider = document.getElementById('p2-range-' + idx + '')
         p2slider.oninput = function () {
             slider = document.getElementById('p1-range-' + idx + '')
             pt1 = []
             pt1.x = point1.x - slider.value * dir.x * (-1)
             pt1.y = point1.y - slider.value * dir.y * (-1)
             pt1.z = point1.z - slider.value * dir.z * (-1)
 
             slider = document.getElementById('p2-range-' + idx + '')
             pt2 = []
             pt2.x = point2.x + slider.value * dir.x * (-1)
             pt2.y = point2.y + slider.value * dir.y * (-1)
             pt2.z = point2.z + slider.value * dir.z * (-1)
 
             id = "skewer-coords-point2-" + idx + ''
             div = document.getElementById(id)
             div.innerHTML = ''
             div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt2.x * (edges.right_edge[0] / gridsize), 3) + ', ' + round(pt2.y * (edges.right_edge[1] / gridsize), 3) + ', ' + round(pt2.z * (edges.right_edge[0] / gridsize), 3) + ' ) Mpc </div>')
             printLine(idx, pt1, pt2)
             saveLine(idx, pt1, pt2)
         }
 
         // button for requesting column density data
         id = 'skewer-coords-' + idx
         div = document.getElementById(id)
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords simple-line-status" id="simple-line-status-' + id + '">   <button type="button" onclick="requestSimpleLineData(' + idx + ')" class="request-button button simple-line-status" id="simple-line-request-button-' + idx + '">Request skewer attributes</button> </div>');
 
         // hook for plotting that graph + dropdown
 
         //create div for REQUEST button and STATUS message below skewer details
         id = 'skewer-coords-' + idx
         div = document.getElementById(id)
         div.insertAdjacentHTML('beforeend', '<div class="skewer-coords spectra-status" id="spectra-status-' + id + '">   <button type="button" onclick="requestSpectrum(' + idx + ')" class="request-button button spectra-status" id="request-button-' + idx + '">Request spectrum</button> </div>');
     }
 
     function saveLine(idx, point1, point2) {
         /**
          * * saveLine() stores the coordinates in the skewer array for later reference
          */
         skewers[idx] = {
             point1: point1,
             point2: point2
         }
         skewer_endpoints[idx] = [
             [skewers[idx].point1.x / gridsize, skewers[idx].point1.y / gridsize, skewers[idx].point1.z / gridsize],
             [skewers[idx].point2.x / gridsize, skewers[idx].point2.y / gridsize, skewers[idx].point2.z / gridsize]
         ]
     }
 }
 
 function cylinderMesh(pointX, pointY) {
     // edge from X to Y
     console.log(pointX, pointY)
     let direction = new THREE.Vector3().subVectors(pointY, pointX);
     // let skewerMaterial = new THREE.MeshBasicMaterial({ color: 0x5B5B5B });
 
     emptyData = new Uint8Array(3 * 1000)
     emptyData.fill(255)
     emptyTexture = new THREE.DataTexture(emptyData.fill(1), 1, 100, THREE.RGBFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.ClampToEdgeWrapping,
         THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter)
     emptyTexture.needsUpdate = true
     low_col = new THREE.Color(document.getElementById("skewerMinCol").value)
     high_col = new THREE.Color(document.getElementById("skewerMaxCol").value)
     skewerMaterial1[idx] = new THREE.ShaderMaterial({
         uniforms: {
             Col: { value: new THREE.Vector4(1.0, 1.0, 0.0, 1.0) },
             u_xyzMin: { value: new THREE.Vector3(domainXYZ[0], domainXYZ[2], domainXYZ[4]) },
             u_xyzMax: { value: new THREE.Vector3(domainXYZ[1], domainXYZ[3], domainXYZ[5]) },
             u_gridsize: { value: gridsize },
             u_low_col: { value: new THREE.Vector4(low_col.r, low_col.g, low_col.b, 1.0) },
             u_high_col: { value: new THREE.Vector4(high_col.r, high_col.g, high_col.b, 1.0) },
             skewer_tex: { value: emptyTexture },
             u_size: { value: new THREE.Vector3(gridsize, gridsize, gridsize) }
         },
         vertexShader: document.getElementById('vertexshader-skewer').textContent,
         fragmentShader: document.getElementById('fragmentshader-skewer').textContent,
         // blending:       THREE.CustomBlending,
         // // blendEquation:  THREE.AddEquation, //default
         // blendSrc:       THREE.OneFactor,
         // blendDst:       THREE.ZeroFactor,
         depthTest: true,
         depthWrite: true,
         transparent: false,
         blending: THREE.NormalBlending,
         // dithering: true,
         // vertexColors: false,
         // morphTargets: true,
         // morphNormals: true,
     });
     // Make the geometry (of "direction" length)
     // //console.log(gridsize)
     skewer_width = (document.getElementById("skewer-width-slider")).value
     let skewerGeometry = new THREE.CylinderBufferGeometry(skewer_width, skewer_width, direction.length(), 100, 1000, true, 0, 2 * Math.PI);
     skewerGeometry.setDrawRange(0, Infinity)
     // shift it so one end rests on the origin
     skewerGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
     // rotate it the right way for lookAt to work
     skewerGeometry.applyMatrix4(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
     // Make a mesh with the geometry
     let skewerMesh = new THREE.Mesh(skewerGeometry, skewerMaterial1[idx]);
     // Position it where we want
     skewerMesh.position.copy(pointX);
     // And make it point to where we want
     skewerMesh.lookAt(pointY.x, pointY.y, pointY.z);
 
     return skewerMesh;
 }
 
 function onMouseWheel(event) {
 
 
 }
 
 function initColor() {
 
     if (localStorage.getItem('gasMinCol')) {
         document.querySelector("#gasMinCol").value = localStorage.getItem('gasMinCol');
         document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
     } else {
         let col = new THREE.Color('rgb(0,0,255)')
         document.querySelector("#gasMinCol").value = '#' + col.getHexString();
     }
     document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
 
     if (localStorage.getItem('gasMidCol')) {
         document.querySelector("#gasMidCol").value = localStorage.getItem('gasMidCol');
         document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value
     } else {
         let col = new THREE.Color('rgb(0,255,0)')
         document.querySelector("#gasMidCol").value = '#' + col.getHexString();
     }
     document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value
 
 
     if (localStorage.getItem('gasMaxCol')) {
         document.querySelector("#gasMaxCol").value = localStorage.getItem('gasMaxCol');
     } else {
         let col = new THREE.Color('rgb(255,0,0)')
         document.querySelector("#gasMaxCol").value = '#' + col.getHexString();
     }
     document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value
 
 
     if (localStorage.getItem('dmMinCol')) {
         document.querySelector("#dmMinCol").value = localStorage.getItem('dmMinCol');
     } else {
         let col = new THREE.Color('rgb(51,0,40)')
         document.querySelector("#dmMinCol").value = '#' + col.getHexString();
     }
     document.querySelector("#dmMinCol").style.backgroundColor = document.querySelector("#dmMinCol").value
 
     if (localStorage.getItem('dmMaxCol')) {
         document.querySelector("#dmMaxCol").value = localStorage.getItem('dmMaxCol');
     } else {
         let col = new THREE.Color('rgb(255,0,212)')
         document.querySelector("#dmMaxCol").value = '#' + col.getHexString();
     }
     document.querySelector("#dmMaxCol").style.backgroundColor = document.querySelector("#dmMaxCol").value
 
 
     if (localStorage.getItem('starMinCol')) {
         document.querySelector("#starMinCol").value = localStorage.getItem('starMinCol');
     } else {
         let col = new THREE.Color('rgb(255,247,0)')
         document.querySelector("#starMinCol").value = '#' + col.getHexString();
     }
     document.querySelector("#starMinCol").style.backgroundColor = document.querySelector("#starMinCol").value
 
     if (localStorage.getItem('starMaxCol')) {
         document.querySelector("#starMaxCol").value = localStorage.getItem('starMaxCol');
     } else {
         let col = new THREE.Color('rgb(255,221,0)')
         document.querySelector("#starMaxCol").value = '#' + col.getHexString();
     }
     document.querySelector("#starMaxCol").style.backgroundColor = document.querySelector("#starMaxCol").value
 
 
     // if( localStorage.getItem('starCol') ){
     //     document.querySelector("#starCol").value = localStorage.getItem('starCol');
     // }
     // else{
     //     document.querySelector("#starCol").value = '#ffffff';
     // }
     // document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value
 
 
     if (localStorage.getItem('bhMinCol')) {
         document.querySelector("#bhMinCol").value = localStorage.getItem('bhMinCol');
     } else {
         document.querySelector("#bhMinCol").value = '#ffffff';
     }
     document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value
 
 
     if (localStorage.getItem('bhMaxCol')) {
         document.querySelector("#bhMaxCol").value = localStorage.getItem('bhMaxCol');
     } else {
         document.querySelector("#bhMaxCol").value = '#ffffff';
     }
     document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value
 
 
     changeColor()
 }
 
 function reloadCss() {
     var links = document.getElementsByTagName("link");
     for (var cl in links) {
         var link = links[cl];
         if (link.rel === "stylesheet")
             link.href += "";
     }
 }
 
 function onWindowResize() {
     camera.left = window.innerWidth / -2
     camera.right = window.innerWidth / 2
     camera.top = window.innerHeight / 2
     camera.bottom = window.innerHeight / -2
     camera.aspect = window.innerWidth / window.innerHeight;
     camera.updateProjectionMatrix();
 
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setPixelRatio(1);
     const size = new THREE.Vector2()
     renderer.getSize(size);
     // //console.log(size)
     var pixelRatio = window.devicePixelRatio;
     starTarget.setSize(size.x, size.y)
     starSaoTarget.setSize(size.x, size.y)
     skewerTarget.setSize(size.x, size.y)
     updateUniforms()
 }
 
 function onKeyUp(event) {
     if (event.keyCode) {
         // console.log("shift")
         setTimeout(function () {
             controls.rotateSpeed = 10.0;
             controls.zoomSpeed = 5.0;
             controls.panSpeed = 5.0;
         }, 5);
     }
 }
 
 function onKeyDown(event) {
     // //console.log(event)
     var k = String.fromCharCode(event.keyCode);
     // //console.log(k)
 
     if (event.keyCode) {
         // console.log("shift")
         setTimeout(function () {
             controls.rotateSpeed = 4.0;
             controls.zoomSpeed = 1.0;
             controls.panSpeed = 1.0;
         }, 5);
 
     }
 
     if (k == "S") {
         /*
          * * Turn gas visibility on an off
          TODO: make it work 
          */
     }
     if (k == "B") {
         /*
          * * Turn gas visibility on an off
          TODO: make it work 
          */
     }
     if (k == "L") {
         /*
          * * Turn gas visibility on an off
          TODO: make it work 
          */
         data_layers()
     }
     if (k == "O") {
         /*
          * * Turn gas visibility on an off
          TODO: make it work 
          */
         ray()
     }
     if (k == "P") {
         /*
          * * Turn gas visibility on an off
          TODO: make it work 
          */
         graph()
     }
 
     const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
 }
 
 function exportData(name, text) {
 
     const a = document.createElement('a');
     const type = name.split(".").pop();
     a.href = URL.createObjectURL(new Blob([text], { type: `text/${type === "txt" ? "plain" : type}` }));
     a.download = name;
     a.click();
 }
 
 /**
  * * WAIT UNTIL PAGE IS LOADED
  */
 
 $(document).ready(function () {
 
 
     $(".container").hover(function () {
         container_hover = true;
     }, function () {
         container_hover = false;
     });
 
 
 
     init()
     animate()
     render()
     // asyncCall(false)
 })
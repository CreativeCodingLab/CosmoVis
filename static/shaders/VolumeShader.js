/**
 * Shaders to render 3D volumes using raycasting.
 * The applied techniques are based on similar implementations in the Visvis and Vispy projects.
 * This is not the only approach, therefore it's marked 1.
 */

THREE.VolumeRenderShader1 = {
	
    uniforms: {
		"u_size": { value: new THREE.Vector3( 1, 1, 1 ) },
		"u_renderstyle": { value: 0 },
		"u_renderthreshold": { value: 0.5 },
		"u_clim": { value: new THREE.Vector2( 1, 1 ) },
		"u_gasUnpackDomain": { value: new THREE.Vector2(0.0,1.0) },
		"u_darkmatterUnpackDomain": { value: new THREE.Vector2(0.0,1.0) },
		"u_densityUnpackDomain": { value: new THREE.Vector2(0.0,1.0) },
		"u_gasClim": { value: new THREE.Vector2( 1, 1 ) },
		"u_dmClim": { value: new THREE.Vector2( 1, 1 ) },
		"u_climDensity": { value: new THREE.Vector2( 1, 1 ) },
		"u_dataTexture3D" : {value: null},
		"u_starData": { value: null },
		"u_density": {value: null },
		"u_cmdata": { value: null },
		"u_cmGasData": { value: null },
		"u_cmDMData": { value: null },
		"u_grayscaleDepthMod": { value: null },
		"u_gasVisibility": {value: true },
		"u_dmVisibility": {value: true },
		"u_starVisibility": {value: true },
		"u_skewerVisibility": {value: true },
		"u_gasClip": {value: [ true, true ]},
		"u_dmClip": {value: [ true, true ]},
		"u_stepSize": { value: 1.0 },
		"u_exposure": { value: 3.0 },
		"u_xyzMin": {value: new THREE.Vector3( 0.0, 0.0, 0.0)},
		"u_xyzMax": {value: new THREE.Vector3( 1.0, 1.0, 1.0)},
		"u_densityMod": {value: null},
		"u_densityModI": {value: null},
		"u_densityDepthMod": { value: null },
		"u_distMod": {value: null},
		"u_distModI": {value: null},
		"u_valMod": {value: null},
		"u_valModI": {value: null},
		"u_starDiffuse": {value: null},
		"u_starDepth": {value: null},
		"u_skewerDiffuse": {value: null},
		"u_skewerDepth": {value: null},
		"u_starCol": {value: new THREE.Vector3( 1.0, 1.0 , 0.0 )},
		"u_cameraNear": { value: 0.00001 },
		"u_cameraFar": { value: 4000.0 },
		"u_screenWidth": {value : null},
		"u_screenHeight": {value : null},
		"u_sigma_t": {value : 0.5},
		"u_sigma_e": {value : 0.5},
		"u_skewerBrightness": {value: 10.0},
    },
	vertexShader: [
		
		"		varying vec4 v_nearpos;",
		"		varying vec4 v_farpos;",
		"		varying vec3 v_position;",
		"		varying vec3 v_cameraPosition;",
		"		out vec3 v_Origin;",
		"		out vec3 v_Direction;",
		"		out vec2 vUv;",

		"		mat4 inversemat(mat4 m) {",
		// Taken from https://github.com/stackgl/glsl-inverse/blob/master/index.glsl
		// This function is licenced by the MIT license to Mikola Lysenko
		"				float",
		"				a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],",
		"				a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],",
		"				a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],",
		"				a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],",

		"				b00 = a00 * a11 - a01 * a10,",
		"				b01 = a00 * a12 - a02 * a10,",
		"				b02 = a00 * a13 - a03 * a10,",
		"				b03 = a01 * a12 - a02 * a11,",
		"				b04 = a01 * a13 - a03 * a11,",
		"				b05 = a02 * a13 - a03 * a12,",
		"				b06 = a20 * a31 - a21 * a30,",
		"				b07 = a20 * a32 - a22 * a30,",
		"				b08 = a20 * a33 - a23 * a30,",
		"				b09 = a21 * a32 - a22 * a31,",
		"				b10 = a21 * a33 - a23 * a31,",
		"				b11 = a22 * a33 - a23 * a32,",

		"				det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;",

		"		return mat4(",
		"				a11 * b11 - a12 * b10 + a13 * b09,",
		"				a02 * b10 - a01 * b11 - a03 * b09,",
		"				a31 * b05 - a32 * b04 + a33 * b03,",
		"				a22 * b04 - a21 * b05 - a23 * b03,",
		"				a12 * b08 - a10 * b11 - a13 * b07,",
		"				a00 * b11 - a02 * b08 + a03 * b07,",
		"				a32 * b02 - a30 * b05 - a33 * b01,",
		"				a20 * b05 - a22 * b02 + a23 * b01,",
		"				a10 * b10 - a11 * b08 + a13 * b06,",
		"				a01 * b08 - a00 * b10 - a03 * b06,",
		"				a30 * b04 - a31 * b02 + a33 * b00,",
		"				a21 * b02 - a20 * b04 - a23 * b00,",
		"				a11 * b07 - a10 * b09 - a12 * b06,",
		"				a00 * b09 - a01 * b07 + a02 * b06,",
		"				a31 * b01 - a30 * b03 - a32 * b00,",
		"				a20 * b03 - a21 * b01 + a22 * b00) / det;",
		"		}",


		"		void main() {",
		"				vec3 v_cameraPosition = cameraPosition;",
		// Prepare transforms to map to "camera view". See also:
		// https://threejs.org/docs/#api/renderers/webgl/WebGLProgram
		"				mat4 viewtransformf = modelViewMatrix;",
		"				mat4 viewtransformi = inversemat(modelViewMatrix);",

		// Project local vertex coordinate to camera position. Then do a step
		// backward (in cam coords) to the near clipping plane, and project back. Do
		// the same for the far clipping plane. This gives us all the information we
		// need to calculate the ray and truncate it to the viewing cone.
		"				vec4 position4 = vec4(position, 1.0);",
		"				vec4 pos_in_cam = viewtransformf * position4;",

		// Intersection of ray and near clipping plane (z = -1 in clip coords)
		"				pos_in_cam.z = -pos_in_cam.w;",
		"				v_nearpos = viewtransformi * pos_in_cam;",

		// Intersection of ray and far clipping plane (z = +1 in clip coords)
		"				pos_in_cam.z = pos_in_cam.w;",
		"				v_farpos = viewtransformi * pos_in_cam;",

		// Set varyings and output pos
		"				v_position = position;",

		"				v_Origin = vec3( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;",
		"				v_Direction = position - v_Origin;",
		"				vUv = uv;",
		"				gl_Position = projectionMatrix * viewMatrix * modelMatrix * position4;",
		"		}",
	].join( "\n" ),
	fragmentShader: [
		"		#include <packing>",
		"		#include <common>",
		"		precision highp int;",
		"		precision highp float;",
		"		precision highp usampler3D;",
		"		precision highp sampler2D;",

		"		uniform vec3 u_size;",
		"		uniform int u_renderstyle;",
		"		uniform float u_renderthreshold;",
		"		uniform vec2 u_clim;",
		"		uniform vec2 u_gasClim;",
		"		uniform vec2 u_dmClim;",
		"		uniform vec2 u_climDensity;",
		"		uniform bvec2 u_gasClip;",
		"		uniform bvec2 u_dmClip;",
		"		uniform float u_stepSize;",
		"		uniform float u_exposure;",

		"		uniform vec2 u_gasUnpackDomain;",
		"		uniform vec2 u_darkmatterUnpackDomain;",
		"		uniform vec2 u_densityUnpackDomain;",

		" 		uniform bool u_gasVisibility;",
		" 		uniform bool u_dmVisibility;",
		" 		uniform bool u_starVisibility;",
		" 		uniform bool u_skewerVisibility;",

		"		uniform highp sampler3D u_dataTexture3D;",

		"		uniform float u_densityDepthMod;",
		"		uniform float u_grayscaleDepthMod;",
		"		uniform float u_dither;",
		"		uniform vec3 u_xyzMin;",
		"		uniform vec3 u_xyzMax;",
		
		"		uniform float u_densityMod;",
		"		uniform float u_distMod;",
		"		uniform float u_valMod;",

		"		uniform float u_densityModI;",
		"		uniform float u_distModI;",
		"		uniform float u_valModI;",

		"		uniform highp usampler3D u_density;",

		"		uniform sampler2D u_cmdata;",
		"		uniform sampler2D u_cmGasData;",
		"		uniform sampler2D u_cmDMData;",

		"		uniform sampler2D u_starDiffuse;",
		"		uniform sampler2D u_starDepth;",
		"		uniform vec3 u_starCol;",

		"		uniform sampler2D u_skewerDiffuse;",
		"		uniform sampler2D u_skewerDepth;",

		"		varying vec3 v_cameraPosition;",
		"		varying vec3 v_position;",
		"		varying vec4 v_nearpos;",
		"		varying vec4 v_farpos;",

		"		uniform float u_cameraNear;",
		"		uniform float u_cameraFar;",
		"		uniform float u_screenWidth;",
		"		uniform float u_screenHeight;",

		"		uniform float u_sigma_t;",
		"		uniform float u_sigma_e;",

		"		uniform float u_skewerBrightness;",
		
		"		in vec3 v_Origin;",
		"		in vec3 v_Direction;",
		"		in vec2 vUv;",
		"		out vec4 fragColor;",
		"		uvec3 dataTexture_i;",
		"		vec3 dataTexture_f;",
		"		uvec3 dataTexture_i1;",
		"		vec3 dataTexture_f1;",
		"		vec2 ray_AABB_intersection(vec3 rp, vec3 rd, vec3 c_lo, vec3 c_hi);",
		"		void cast_raymarching();",
		"		float rnd(vec2 x);",
		"		vec3 sampleData(highp sampler3D data, vec3 texcoords);",
		"		vec4 get_emitted_L_gas(float gas_val, float density_val);",
		"		vec4 get_emitted_L_darkmatter(float dm_val, float density_val);",
		"		vec3 grayscale(vec3 inputColor);",
		"		vec3 grayscaleAmount(vec3 inputColor, float amount);",
		"		vec4 apply_colormap(float val);",
		"		vec3 coord_normalized_to_texture(vec3 coord, vec3 c_lo, vec3 c_hi, vec3 size);",

		"		void main() {",
		"			cast_raymarching();",
		"		}",

		`		void cast_raymarching() {
					// three sources of signal: attribute (gas), dark matter, density
					// stars act as stopping condition

					vec3 c_lo = u_xyzMin*u_size; // xyzMin/Max between 0 and 1
					vec3 c_hi = u_xyzMax*u_size; // u_size is the edge voxel count
						//if camera == perspective , else camera == orthographic
					vec3 rp = cameraPosition;
					vec3 rd = normalize(v_Direction); //normalize(nearpos.xyz - farpos.xyz);
						// rp = ray position, initial value = camera position relative to big_box=[0,gridsize]
						// rd = normalized ray direction relative to big_box=[0,gridsize] vec3 view_ray = normalize(nearpos.xyz - farpos.xyz);
						// c_lo, c_hi = min and max corners of the box (respectively)  trimmed_box=[get coords based on uniform]

					vec2 t = ray_AABB_intersection(rp, rd, c_lo, c_hi);
						// clamp t.x to 0 to avoid rendering anything behind the camera
						// if t.y is + there is something to render, if t.y is - then the integral is behind the camera...		
						// convert current position and ray direction to voxel distance
					rp = rp + t.x * rd;

					// fetch depth of stars and skewers
					float fragCoordZ = texture2D(u_starDepth, gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).x;
					float viewZ = perspectiveDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);
					float starDepth = viewZToPerspectiveDepth( viewZ, u_cameraNear, u_cameraFar );

					fragCoordZ = texture2D(u_skewerDepth, gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).x;
					viewZ = perspectiveDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);
					float skewerDepth = perspectiveDepthToViewZ( viewZ, u_cameraNear, u_cameraFar );
							
					// determine number of steps based on A) back of cube B) depth of star, or C) depth of skewer
					
					float integration_limit = 0.0;
					if(starDepth > t.y && starDepth > skewerDepth){
						integration_limit = starDepth;
					}

					else if(skewerDepth > t.y && starDepth < skewerDepth){
						integration_limit = skewerDepth;
					}
					else integration_limit = t.y;

					rd = rd * (integration_limit - t.x); // rd is as long as interval within the box; not normalized, in voxel distance

					// if(starCol.r > 0.3 && starCol.g > 0.3){
						
					// }
					// else gl_FragColor = vec4(0.0,0.0,0.0,1.0);
					// vec3 col = starCol / (starDepth*starDepth);
					// gl_FragColor = vec4(col,1.0);
					// return;

					int iSteps = int(length(rd)); // iSteps = number of steps in the ray; determine step size, length, direction
					vec3 dd = rd / float(iSteps); // dd = distance differential (one step forward in world size units), should end up being ~1 (voxel units)
					rd = normalize(rd); // direction is normalized to use as multiplier
						// can use random seed
					rp += (rnd(gl_FragCoord.xy) - 0.5) * dd; //perturbing the position where the integration starts by half a voxel, reduce effects of artefacts by introducing a little noise
					vec3 path_L = vec3(0.0, 0.0, 0.0); // light collected for the ray (path tracer) -- total quantity light coming from the volume
					float tau = 0.0; // accumulated optical thickness through the volume 
					vec3 gas_darkmatter_density0 = sampleData(u_dataTexture3D, rp); // normally called 'rho'
					
					float density_val = (u_densityUnpackDomain[1] - u_densityUnpackDomain[0])*(( float(gas_darkmatter_density0.b) - 0.0) / (255.0)) + u_densityUnpackDomain[0];
					float rho0 = max(0.0,((density_val - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0]))); //get_rho(rp), rho1; // rho ~ density; rho0 ~ first point in the volume; rho1 ~ not initialized yet
					
					float transmittance = 0.0;
					
					for (int i = 0; i < iSteps; i++) {
						rp += dd; // move position along the ray by 1 step forward (dd), ~1 voxel unit

						vec3 gas_darkmatter_density1 = sampleData(u_dataTexture3D, rp); //get texture values at each step
						
						float density_val1 = (u_densityUnpackDomain[1] - u_densityUnpackDomain[0])*(( float(gas_darkmatter_density1.b) - 0.0) / (255.0)) + u_densityUnpackDomain[0];
						float rho1 = max(0.0,((density_val1 - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0]))); //get_rho(rp); // gets rho1 for the position
						float rho = 0.5 * (rho0 + rho1); // actual density (rho) is the average between the two (assume piecewise linear density function)
						vec3 gas_darkmatter_density = 0.5 * (gas_darkmatter_density0 + gas_darkmatter_density1);
						vec3 emission = vec3(0.0, 0.0, 0.0);
						
						float scaling_factor = 100.0/u_size.x;
					// gas + dark matter contribute to optical density
						if( u_gasVisibility == true ){
							vec4 gas_emission = get_emitted_L_gas(float(gas_darkmatter_density.r),rho);
							tau      += scaling_factor * rho * gas_emission.a; 					  // tau ~ accumulated thickness/density of the volume 
							emission += scaling_factor * rho * gas_emission.rgb * gas_emission.a; // rho is the main determinant in how much light the volume should emit. this function also gets transfer function color. add because there can be multiple sources of emission (gas, dm, stars)
						}

						if( u_dmVisibility == true ){
							vec4 darkmatter_emission = get_emitted_L_darkmatter(float(gas_darkmatter_density.g),rho);
							tau      += scaling_factor * rho * darkmatter_emission.a ; 							// tau ~ accumulated thickness/density of the volume 
							emission += scaling_factor * rho * darkmatter_emission.rgb * darkmatter_emission.a; // rho is the main determinant in how much light the volume should emit. this function also gets transfer function color. add because there can be multiple sources of emission (gas, dm, stars)
						}

					//star color will get added to emission, star detection
						transmittance = exp(-u_sigma_t * tau); // sigma_t is constant (overall optical thickness of volume) --> derived from sliders, weights (i.e. function of temperature), always ends up between (0,1)

						path_L += transmittance * u_sigma_e * emission; // slap them together. transmittance [0,1], rho ~ local density, sigma_e ~ global multiplier for emitted energy of the medium
						gas_darkmatter_density0 = gas_darkmatter_density1;
						rho0 = rho1; // move the integration one step forward
					}
					// if star || skewer is visible, multiply color by transmittance (0,1)
					if(u_starVisibility == true) {
						vec3 starCol = texture2D(u_starDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;
						if( starCol.r > 0.1) path_L += transmittance * ((starCol)/(starDepth*starDepth));
					}
					if(u_skewerVisibility == true) {
						vec3 skewerCol = texture2D(u_skewerDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;
						if(skewerCol.r != 0.0) path_L += u_skewerBrightness * transmittance * skewerCol; ((0.4*path_L) + (0.6*(skewerCol))); //50.0 * sqrt(transmittance) * skewerCol; //
						
						// else path_L += 100.0 * transmittance * skewerCol;
					}

					vec4 c = vec4(vec3(1.0,1.0,1.0) - exp(-u_exposure*path_L),1.0);
					fragColor = c;
					
				}
		`,

		`
				vec3 coord_normalized_to_texture(vec3 coord, vec3 c_lo, vec3 c_hi, vec3 size) {
					vec3 coord_rel = (coord - c_lo) / (c_hi - c_lo);
					coord_rel.y = 1.0-coord_rel.y;
					coord_rel.z = 1.0-coord_rel.z;
					return coord_rel * size;
				}
		`,

		"		vec2 ray_AABB_intersection(vec3 rp, vec3 rd, vec3 c_lo, vec3 c_hi) {",
					//intersection code
					// rp = ray position, initial value = camera position relative to big_box=[0,gridsize]
					// rd = normalized ray direction relative to big_box=[0,gridsize] vec3 view_ray = normalize(nearpos.xyz - farpos.xyz);
					// c_lo, c_hi = min and max corners of the box (respectively)  trimmed_box=[get coords based on uniform]
					// return val = vec2 --> both intersections
					// x = near intersection 
					// y = far intersection
					// no intersection --> both negative (-1,-1)?
					// after getting return value, to get coord --> rp + rd * val (first and last 3D position on the cube)
					// use this to get number of integration steps
		"			float t[8];",
		"			t[0] = (c_lo.x - rp.x) / rd.x;",
		"			t[1] = (c_hi.x - rp.x) / rd.x;",
		"			t[2] = (c_lo.y - rp.y) / rd.y;",
		"			t[3] = (c_hi.y - rp.y) / rd.y;",
		"			t[4] = (c_lo.z - rp.z) / rd.z;",
		"			t[5] = (c_hi.z - rp.z) / rd.z;",
		"			t[6] = max(max(min(t[0], t[1]), min(t[2], t[3])), min(t[4], t[5]));",
		"			t[7] = min(min(max(t[0], t[1]), max(t[2], t[3])), max(t[4], t[5]));",
		"			return (t[7] < 0.0 || t[6] >= t[7]) ? vec2(-1.0, -1.0) : vec2(t[6], t[7]);",
		"		}",

		"		float rnd(vec2 x){",
		"			int n = int(x.x * 40.0 + x.y * 6400.0);",
		"			n = (n << 13) ^ n;",
		"			return 1.0 - float( (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;",
		"		}",

		`
				vec3 sampleData(highp sampler3D data, vec3 texcoords) {
						/* Sample float value from a 3D texture. Assumes intensity data. */
						return texture(data, texcoords.xyz/u_size).rgb;
				}
		`,

		`		vec4 get_emitted_L_gas(float gas_val, float density_val){
					float a;
					
					gas_val = (u_gasUnpackDomain[1] - u_gasUnpackDomain[0])*((gas_val - 1.0) / (255.0)) + u_gasUnpackDomain[0];

					// check if region is clipped based on min/max values in the data
					// 
					if( (u_gasClip[0] == true) && (gas_val < u_gasClim[0]) ) a = 0.0;
					else if( (u_gasClip[1] == true) && (gas_val > u_gasClim[1]) ) a = 0.0;
					else a = 1.0;
					
					
					//scale gas value back into meaningful numbers
					
					// scale gas value between 0 and 1
					gas_val = (gas_val - u_gasClim[0]) / (u_gasClim[1] - u_gasClim[0]);
					
					// fetch transfer function texture from gas data
					// rgb comes from the color pickers
					// a comes from sliders
					vec4 tex = texture2D(u_cmGasData, vec2(gas_val, 0.5));

					if (a > 0.0){
						a = density_val * u_densityModI + u_valModI * u_valMod * gas_val;
						tex.a *= a;
					}
					else tex = vec4(0.0,0.0,0.0,0.0);
					return tex;
				}
		`,

		`		vec4 get_emitted_L_darkmatter(float dm_val, float density_val){
					float a;

					float new_dm_val = ((u_darkmatterUnpackDomain[1] - u_darkmatterUnpackDomain[0])*((dm_val - 0.0) / (255.0))) + u_darkmatterUnpackDomain[0];

					if( 	 (u_dmClip[0] == true) && (new_dm_val < u_dmClim[0]) ) a = 0.0;
					else if( (u_dmClip[1] == true) && (new_dm_val > u_dmClim[1]) ) a = 0.0;
					else a = 1.0;

					new_dm_val = min(1.0, (new_dm_val - u_dmClim[0]) / (u_dmClim[1] - u_dmClim[0]));

					vec4 tex = texture2D(u_cmDMData, vec2(new_dm_val, 0.0));
					
					if (a > 0.01){
						a = density_val * u_densityModI + u_valModI * u_valMod * new_dm_val;
						tex.a *= a;
					}
					else tex = vec4(0.0,0.0,0.0,0.0);

					return tex;
				}
		`,

		"		vec4 apply_colormap(float val) {",
		"				vec4 tex = texture2D(u_cmdata, vec2(val, 0.5));",
		"				return tex;",
		"		}",

		"		vec3 grayscale(vec3 inputColor){",
		"			float gray = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722 ));",
		"			return vec3(gray, gray, gray);",
		"		}",
		"		vec3 grayscaleAmount(vec4 inputColor, float amount){",
		"			vec3 outputColor = mix(inputColor.rgb, grayscale(inputColor.rgb), 1.0-1.0/amount);",
		"			return outputColor;",
		"		}",
		
		"		vec3 WorldPosFromDepth(float depth) {",
		"			vec2 ndc;",
		"			vec3 eye;",
		"			ndc.x = ( ( gl_FragCoord.x * (1.0/u_screenWidth)  ) - 0.5) * 2.0;",
		"			ndc.y = ( ( gl_FragCoord.y * (1.0/u_screenHeight) ) - 0.5) * 2.0;",
		"			eye.z = u_cameraNear * u_cameraFar / ((depth * (u_cameraFar - u_cameraNear)) - u_cameraNear);",
		"			eye.x = ( -ndc.x * eye.z ) * 1.0 / u_cameraNear;",
		"			eye.y = ( -ndc.y * eye.z ) * 1.0 / u_cameraNear;",
		"			return eye;",
		"		}",

		"		vec2 worldToScreenSpace(vec3 loc){",
		"			vec2 ndc;",
		"			ndc.x = ( ( gl_FragCoord.x * (1.0/u_screenWidth)  ) - 0.5) * 2.0;",
		"			ndc.y = ( ( gl_FragCoord.y * (1.0/u_screenHeight) ) - 0.5) * 2.0;",
		"			return ndc;",			
		"		}",

		"		vec4 apply_dvr_colormap(float val, bvec2 clip, vec2 clim, sampler2D cm_texture, float density, vec3 texcoords, int iter) {",
		"				float a;",
		"				vec4 tex;",
		"				float delta = distance(cameraPosition,texcoords);",
		"				if(u_densityDepthMod == 1.0){",
		"					density = ((density - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0]));",
		"				}",
		"				else{",
		"					density = 0.0;",
		"				}",
	
		"				if( (clip[0] == true) && (val < clim[0]) ){",
		"					a = 0.0;",
		"				}",
		"				else if( (clip[1] == true) && (val > clim[1]) ){",
		"					a = 0.0;",
		"				}",
		"				else{",
		"					a = 1.0;",
		"				}",
		"				val = (val - clim[0]) / (clim[1] - clim[0]);",
		"				tex = texture2D(cm_texture, vec2(val, 0.5));",
		"				if(a > 0.00000001){",  //} && val<=0.5){",
		"					a = u_densityModI * density * u_densityMod + u_valModI * u_valMod * val;",// + u_distModI * delta * u_distMod;",
		// "						a = exp(-u_valModI*u_valMod*val);",
		// "					tex = texture2D(cm_texture, vec2(val, 0.5));",
		"					tex.a *= a;",
		"				}",
		"				else{ tex.rgba = vec4(0.0,0.0,0.0,0.0);}",
		// "				vec4 tex = texture2D(cm_texture, vec2(val, 0.5));",
		// "				tex.a = a;",

		// "				tex.a = (a_gas+a_dm)/1.0;",
		"				if(u_grayscaleDepthMod == 1.0){",
		"					tex.rgb = grayscaleAmount(tex, float(u_size)/(delta));",
		"				}",
		// "				tex.a = tex.a*u_stepSize;",//(float(iter)/u_stepSize);",
		"				return tex;",
		"		}",

		// "			float fragCoordZ = texture2D(u_starDepth, gl_FragCoord.xy).x;",
		// "			float viewZ = orthographicDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);",
		// "			float starDepth = viewZToOrthographicDepth( viewZ, u_cameraNear, u_cameraFar );",
		// "			fragCoordZ = texture2D(u_skewerDepth, gl_FragCoord.xy).x;",
		// "			viewZ = orthographicDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);",
		// "			float skewerDepth = viewZToOrthographicDepth( viewZ, u_cameraNear, u_cameraFar );",
		// // "			if((loc.x>u_xyzMin[0] && loc.x<u_xyzMax[0]) && (loc.y>u_xyzMin[1] && loc.y<u_xyzMax[1]) && (loc.z>u_xyzMin[2] && loc.z<u_xyzMax[2])){",
		// "				vec4 c_gas = apply_dvr_colormap(gas_darkmatter_density.r,u_gasClip,u_gasClim,u_cmGasData,gas_darkmatter_density.b,loc,iter);",
		// "				vec4 c_dm = apply_dvr_colormap(gas_darkmatter_density.g,u_dmClip,u_dmClim,u_cmDMData,gas_darkmatter_density.b,loc,iter);",
		// "				vec3 c_stars = texture2D(u_starDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;",
		// "				vec3 c_skewers = texture2D(u_skewerDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;",

		
		
		// "		void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {",
		// "			vec3 loc = start_loc - step*rnd(vec2(-0.5,0.5));",
		// //emission absorption model
		// "			float sigma_a = 0.5;",
		// "			float sigma_s = 0.0;", //sigma_t  = sigma_a + sigma_s (extinction)
		// "			vec3 sigma_e = vec3(1.0,1.0,1.0);",
		
		// "			vec4 c = vec4(0.0,0.0,0.0,0.0);",
		// "			vec4 c_gas = vec4(0.0,0.0,0.0,0.0);",
		// "			vec4 c_dm = vec4(0.0,0.0,0.0,0.0);",
		// "			vec4 path_L = vec4(0.0,0.0,0.0,0.0);",//0.4*vec4(0.0156,0.0234,0.0898,0.0);",
		// "			float tau = 0.0;",
		// "			float rho0 = sampleDensity(loc);",
		// "			rho0 = max(0.0,((rho0 - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0])));",
		// 			// Enter the raycasting loop. In WebGL 1 the loop index cannot be compared with
		// 			// non-constant expression. So we use a hard-coded max, and an additional condition
		// 			// inside the loop.
		// "			float fragCoordZ = texture2D(u_starDepth, gl_FragCoord.xy).x;",
		// "			float viewZ = orthographicDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);",
		// "			float starDepth = u_size.x*viewZToOrthographicDepth( viewZ, u_cameraNear, u_cameraFar );",

		// 			// run for loop only until given star depth (if there is a star there)
		// 			// maybe a use a while loop
		// 			// start iteration at the edge of xyzMin/Max cube instead of checking each step, empty space skipping
		// "			for (int iter=0; iter<int(starDepth); iter++) {",//int(float(MAX_STEPS)/u_stepSize

		// 				// Sample from the 3D textures
		// "				vec3 gas_darkmatter_density = sampleData(u_dataTexture3D, loc);",
		// // "				float gasVal = sampleData(u_gasData, loc);",
		// // "				float dmVal = sampleData(u_dmData, loc);",
		// // "				float density = sampleDensity(loc);",
		// // depth of the stars
		// // "				float fragCoordZ = texture2D(u_starDepth, gl_FragCoord.xy).x;",
		// // "				float viewZ = orthographicDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);",
		// // "				float starDepth = viewZToOrthographicDepth( viewZ, u_cameraNear, u_cameraFar );",
		
		// // depth of skewer
		// "				fragCoordZ = texture2D(u_skewerDepth, gl_FragCoord.xy).x;",
		// "				viewZ = orthographicDepthToViewZ(fragCoordZ,u_cameraNear,u_cameraFar);",
		// "				float skewerDepth = viewZToOrthographicDepth( viewZ, u_cameraNear, u_cameraFar );",

		// "				if((loc.x>u_xyzMin[0] && loc.x<u_xyzMax[0]) && (loc.y>u_xyzMin[1] && loc.y<u_xyzMax[1]) && (loc.z>u_xyzMin[2] && loc.z<u_xyzMax[2])){",
		// "					vec4 c_gas = apply_dvr_colormap(gas_darkmatter_density.r,u_gasClip,u_gasClim,u_cmGasData,gas_darkmatter_density.b,loc,iter);",
		// "					vec4 c_dm = apply_dvr_colormap(gas_darkmatter_density.g,u_dmClip,u_dmClim,u_cmDMData,gas_darkmatter_density.b,loc,iter);",
		// "					vec3 c_stars = texture2D(u_starDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;",
		// "					vec3 c_skewers = texture2D(u_skewerDiffuse,gl_FragCoord.xy/vec2(u_screenWidth,u_screenHeight)).rgb;",

		// "					vec3 emission = vec3(0.0,0.0,0.0);",
		// "					float transmittance = 0.0;",			
		// "					float rho = 4.0*max(0.0,((gas_darkmatter_density.b - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0])));", //try out gasVal + dmVal
		// "					if( u_gasVisibility == true ){",
		// "						tau = length(step)*c_gas.a*rho;", // number of occluded particles (do this twice, DM + Gas)
		// "						transmittance += exp(-(sigma_a+sigma_s)*tau);", // the photons that make it through, as tau increases, transm -> 0
		// "						emission += sqrt(gas_darkmatter_density.r/2.0)*c_gas.a*c_gas.rgb;",
		// // "						path_L.rgb += length(step) * transmittance * rho * sigma_e * emission;",
		// "					}",
		// "					if( u_dmVisibility == true ){",
		// "						tau = length(step)*c_dm.a*rho;", // number of occluded particles (do this twice, DM + Gas)
		// "						transmittance += exp(-(sigma_a+sigma_s)*tau);", // the photons that make it through, as tau increases, transm -> 0
		// "						emission += c_dm.a * c_dm.rgb;",
		// // "						path_L.rgb += length(step) * transmittance * rho * sigma_e * emission;",
		// "					}",
		// "					if(u_starVisibility == true){",
		// 						// if there is a star in the pixel, run integration only until that depth
		// "						tau = (1.0/(exp(starDepth)))*length(step)*0.75;", // number of occluded particles (do this twice, DM + Gas)
		// "						transmittance += exp(-(sigma_a+sigma_s)*tau);", // the photons that make it through, as tau increases, transm -> 0
		// "						emission += transmittance*c_stars;", //multiply instead of add
		// // "						if(c_stars != vec3(0.0,0.0,0.0)){",
		// // "							path_L.a = 1.0;",
		// // "							c = vec4(1.0,1.0,1.0,1.0) - exp(-u_exposure*path_L.rgba);",
		// // "							gl_FragColor = c;",
		// // "							break;", // break if it hits a star
		// // "						}", 
							
		// // "						path_L.rgb += length(step) * transmittance * sigma_e * emission;",
		// "					}",
		// "					bool u_skewerVisibility = true;",
		// "					if(u_skewerVisibility == true){",
		// "						tau = (1.0/(exp(skewerDepth)))*length(step)*1.0;", // number of occluded particles (do this twice, DM + Gas)
		// "						transmittance += exp(-(sigma_a+sigma_s)*tau);", // the photons that make it through, as tau increases, transm -> 0
		// "						emission += c_skewers;",
		// // "						path_L.rgb += length(step) * transmittance * sigma_e * emission;",
		// "					}",
		// // "					if(transmittance < 0.0001){",
		// // "						break;",
		// // "					}",
		// "					path_L.rgb += length(step) * transmittance * rho * sigma_e * emission;", //multiply by step size
		// "				}",
		// 				// Resolve final color
		// "				path_L.a = 1.0;",
		// "				c = vec4(1.0,1.0,1.0,1.0) - exp(-u_exposure*path_L.rgba);",
		// "				gl_FragColor = c;",
		// "				loc += step;",
		// "			}",
		// "		}",
	].join( "\n" )
};
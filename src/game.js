// import {DragControls} from 'https://cdn.jsdelivr.net/npm/drag-controls@1.0.4/dist/drag-controls.min.js';


//Sun Config
const parameters = {
    inclination: 0.1,
    azimuth: 0.205
};
// missile Config
const missileDimensions = {
    rT : 0.1,
    rB : 0.1,
    h : 1,
    radSeg : 32
};

// Global variables to store states of the game
let player = {};
let enemies = [];
let bossEnemy = null;
let environment = {};
let scene ;
let camera;
let renderer;
let sun, water,sky;
let aesthetics = [];
let lastTimeStamp=0;
const canvas = document.querySelector('#game_view');
const labelContainerElem = document.querySelector('#labels');
const scoreDiv = document.querySelector("#score");
const tempV = new THREE.Vector3();
let starModel;
let stars = [];
const z_speed = 0.1;
const starReward = 100;
const enemyFireFreq =5;
let enemyMissiles = [];
const enemyMissileDamage = 50;
let helicopterModel;


// Function to get CUBE Object
function getCube(){
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00} );
    let cube = new THREE.Mesh( geometry, material );
    return cube;
}
// Function to get Sphere Object
function getSphere(){
    const geometry = new THREE.SphereGeometry( 1, 32, 32 );
    const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    const sphere = new THREE.Mesh( geometry, material );
    return sphere;
}

// Function to load and get Star Object
function getStar(pos){
    // var starMesh;
    var loader = new THREE.ColladaLoader();
    loader.load(
        '../models/star.dae'
        , function (object)
        {
            console.log(object);
            starModel = object.scene;
            starModel.position.set(pos[0],pos[1],pos[2]);
            // plane.rotation.y+=Math.PI;
            starModel.rotation.x+=Math.PI/2;
            // objects.push(plane);
            // player.model=plane;
            // scene.add(starModel);
        }
    )
    return starModel;
}

// Function to load and get Helicopter Object (enemy)
function getHelicopter(){
    // var starMesh;
    var loader = new THREE.ColladaLoader();
    loader.load(
        '../models/helicopter.dae'
        , function (object)
        {
            // console.log(object);
            helicopterModel = object.scene;
            // helicopterModel.position.set(pos[0],pos[1],pos[2]);
            // plane.rotation.y+=Math.PI;
            helicopterModel.rotation.z+=Math.PI;
            // objects.push(plane);
            // player.model=plane;
            // scene.add(helicopterModel);
        }
    )
    return helicopterModel;
}


// Building the background for the Game, defining Sun and Ocean

function buildScene(){
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2( 0xffffff  );
    const light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );
    sun = new THREE.Vector3();

    // Water

    const waterGeometry = new THREE.PlaneGeometry( 10000, 10000 );

    water = new THREE.Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load( '../textures/waternormals.jpg', function ( texture ) {

                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

            } ),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,   //Realisitic blue color
            // waterColor: 0x379ECC, //Blue Color from Sky force
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );

    water.rotation.x = - Math.PI / 2;
        
    scene.add( water );

    // Skybox

    sky = new THREE.Sky();
    sky.scale.setScalar( 10000 );
    scene.add( sky );

    const skyUniforms = sky.material.uniforms;

    skyUniforms[ 'turbidity' ].value = 10;
    skyUniforms[ 'rayleigh' ].value = 2;
    skyUniforms[ 'mieCoefficient' ].value = 0.005;
    skyUniforms[ 'mieDirectionalG' ].value = 0.8;
    return scene;
}

// Utility Function to set position of the sun based on inclination and azimuthal angle
function updateSun() {

    const theta = Math.PI * ( parameters.inclination - 0.5 );
    const phi = 2 * Math.PI * ( parameters.azimuth - 0.5 );

    sun.x = Math.cos( phi );
    sun.y = Math.sin( phi ) * Math.sin( theta );
    sun.z = Math.sin( phi ) * Math.cos( theta );

    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();
    
    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    scene.environment = pmremGenerator.fromScene( sky ).texture;

}



// initial setup for game : sets scens, background etc
function initSetup()
{
    scene = buildScene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(0,30,20);
    camera.lookAt(0,10,0);
    // camera.position.set(x, y, z);
    renderer = new THREE.WebGLRenderer({canvas});
    renderer.setSize( window.innerWidth, window.innerHeight );

    updateSun();
    initGame();

}

// Initialses the game : resets the player etc
function initGame(){
    getStar([1000,1000,1000]);
    resetPlayer();
    // updateEnemy();
}

// Reset the player to initial config, and resets score to 0
function resetPlayer()
{
    player.score=0
    player.totalHealth=800;
    player.health=player.totalHealth;
    player.missiles = [];
    player.damage = 200;
    var loader = new THREE.ColladaLoader();
    loader.load(
        '../models/plane.dae'
        , function (object)
        {
            // console.log(object);
            let plane = object.scene;
            plane.position.y=10;
            plane.rotation.y+=Math.PI;
            // plane.rotation.x+=Math.PI/2;
            objects.push(plane);
            player.model=plane;
            scene.add(plane);
        }
    )
    player.elem = document.createElement('div');
    player.elem.textContent = "Player";
    labelContainerElem.appendChild(player.elem);
    scoreDiv.textContent=player.score.toString();

    
}

// Updates the player, detects collision etc
function updatePlayer(){
    if(player.health<=0){
        renderer.setAnimationLoop(null);
    }
    player.missiles.forEach(function(missile, index, object){
        let enemy = detectMissileCollision(missile);
        // console.log("updatePlayer",enemy);
        if (enemy == null)
            missile.position.z-=1;
        else
            {
                // console.log(enemy);
                scene.remove(missile);
                object.splice(index,1);
                damageEnemies(enemy);
            }
    });
    player.model.updateWorldMatrix(true, false);
    player.model.getWorldPosition(tempV);
    tempV.project(camera);

    const x = (tempV.x *  .5 + .5) * canvas.clientWidth;
    const y = (tempV.y * -.5 + .5) * canvas.clientHeight;
    player.elem.textContent = Math.trunc((player.health/player.totalHealth)*100).toString();
    player.elem.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
    scoreDiv.textContent = player.score.toString();
    // updateStars();
    // removeStrayPlayerMissiles();
}

function updateScene(){

}
// get a random direction for enemies movement
function getRandomDirection(){
    if (Math.floor(Math.random()*100)%2==0)
        return -1;
    else
        return 1;
}
// Update enemy, update its positions and missiles
function updateEnemy(timeDelta){
    if (enemies.length<=10)
    {
        let newEnemyCount = Math.random()*10;
        for (let i=0;i<newEnemyCount;i++){
            generateNewEnemy(i*(10*Math.PI/180),getRandomDirection());
            // console.log(i*(10*Math.PI/180));
        }
    }
    enemies.forEach(enemy => {
        moveEnemy(timeDelta,enemy);
    });
    enemyMissiles.forEach(function(missile, index, object){
        let bbox=new THREE.Box3().setFromObject(missile);
        let bbox2 = new THREE.Box3().setFromObject(player.model);
        if(bbox.intersectsBox(bbox2) && missile.position.toArray().includes(NaN)==false){
            player.health-=enemyMissileDamage;
            scene.remove(missile);
            object.splice(index,1);
        }
        else{
            missile.position.z+=0.5;
        }
    });
    destroyDefunctEnemies();
    removeStrayEnemyMissiles();
}

// remove the enemy from the scene who have completed one round
function destroyDefunctEnemies(){
    // console.log("Before",enemies.length);
    for(let i=0;i<enemies.length;i++){
        let enemy = enemies[i];
        if (Math.abs(enemy.end)<=Math.abs(enemy.angle)){
            scene.remove(enemy.model);
            enemies.splice(i,1);
        }
    }
    // console.log("after",enemies.length);
}
// Generates a new random enemy
function generateNewEnemy(initAngle,direction){
    let enemy = {}
    enemy.totalHealth = 200;
    enemy.health = enemy.totalHealth;
    enemy.model = getHelicopter();
    enemy.model.position.y=10;
    enemy.dir = direction;
    enemy.angle=(direction>0?(initAngle-Math.PI):(initAngle-(Math.PI/4)));
    enemy.end = (direction>0?Math.PI:-Math.PI*2);
    enemy.center = (direction>0?[-100,10,-50]:[100,10,-50])
    enemy.radius = 100;
    enemy.speed = .5;
    enemy.lastFire = 0;
    enemy.missileSpeed = 0.1+Math.random();
    const posx=Math.cos(initAngle)*enemy.radius;
    const posz=Math.sin(initAngle)*enemy.radius;
    enemy.model.position.set(posx+enemy.center[0],10,posz+enemy.center[2]);
    scene.add(enemy.model);
    enemies.push(enemy);

}

// Moves the enemy in a circle
function moveEnemy(timeDelta,enemy){
    // console.log(timeDelta);
    enemy.angle+=enemy.dir*enemy.speed*timeDelta;
    const posx=Math.cos(enemy.angle)*enemy.radius;
    const posz=Math.sin(enemy.angle)*enemy.radius;
    enemy.model.position.set(posx+enemy.center[0],10,posz+enemy.center[2]);
    if (enemy.lastFire<enemyFireFreq){
        enemy.lastFire+=timeDelta;
    }
    else {
        // console.log("Enenmy Fire");
        enemy.lastFire = 0;
        let missile = fire(enemy.model.position.toArray(),0xB269FF);
        enemyMissiles.push(missile);
        scene.add(missile);
        
    }
    // enemy.boxHelper.position.set(posx,10,posz);

    // enemy.boxHelper.update();
}


// Detect collision between players missile and enemy missile
function detectMissileCollision(missile){
    let bbox=new THREE.Box3().setFromObject(missile);
    for(let i=0;i<enemies.length;i++){
        let bbox2 = new THREE.Box3().setFromObject(enemies[i].model);
        if(bbox.intersectsBox(bbox2) && enemies[i].model!=undefined){
            // console.log("Missile : ",missile.position);
            // console.log("Plane : ",enemies[i].model.position);
            // scene.remove(enemy.model);
            return enemies[i];
        }
    }
    return null; 

}


function damageEnemies(enemy){
    console.log(enemy);
    let idx = enemies.indexOf(enemy);
    enemies[idx].health-=player.damage;
    if (enemies[idx].health<=0){
        let pos_enemy = enemy.model.position.toArray();
        let star = getStar(pos_enemy);
        // star.position.set(pos_enemy[0],pos_enemy[1],pos_enemy[2]);
        scene.add(star);
        stars.push(star);
        scene.remove(enemy.model);
        enemies.splice(idx,1);
    }
}

function updateStars(){
    let bbox=new THREE.Box3().setFromObject(player.model);
    for(let i=0;i<stars.length;i++){
        // console.log(stars);
        let bbox2 = new THREE.Box3().setFromObject(stars[i]);
        if(bbox.intersectsBox(bbox2) && stars[i].position.toArray().includes(NaN)==false){
            // scene.remove(enemy.model);
            // console.log("Reward : ",stars[i].position);
            player.score+=starReward;
            console.log("Score :", player.score);
            scene.remove(stars[i]);
            stars.splice(i,1);
            // return enemies[i];
        }
    }
    // console.log(stars);
    stars.forEach(star => {
        star.position.z+=z_speed;
        star.rotation.y+=0.1;
    })
}

function removeStrayEnemyMissiles(){
    for(let i=0;i<enemyMissiles.length;i++){
        let missile = enemyMissiles[i];
        if(missile.position.z>1000){
            scene.remove(missile);
            enemies.splice(i,1);
        }
    }
}

function removeStrayPlayerMissiles(){
    for(let i=0;i<player.missiles.length;i++){
        let missile = player.missiles[i];
        if(missile.position.z<5000){
            scene.remove(missile);
            player.missiles.splice(i,1);
        }
    }
}



    const objects = [];
    initSetup();
 
    let cube = getCube();
    scene.add( cube );
    objects.push(cube);

    var orbitControls = new THREE.OrbitControls( camera, renderer.domElement );
    orbitControls.maxPolarAngle = Math.PI * 1;
    orbitControls.target.set( 0, 10, 0 );
    orbitControls.minDistance = 0.0;
    orbitControls.maxDistance = 200.0;
    orbitControls.update();
    orbitControls.addEventListener( 'change', render );
    document.addEventListener("keydown", onDocumentKeyDown, false);

  

    window.addEventListener('resize', function()
    {
        var width = window.innerWidth;
        var height = window.innerHeight;
        renderer.setSize(width,height);
        camera.aspect = width/height;
        camera.updateProjectionMatrix();
    }
    );

    function animate() {
        requestAnimationFrame( animate );
        let timestamp= performance.now()/1000;
        let timeDelta = timestamp-lastTimeStamp;
        lastTimeStamp=timestamp;
        // controls.update();
        renderer.render( scene, camera );
        // cube.rotation.x += 0.01;
        cube.position.z += 0.05;
        water.material.uniforms[ 'time' ].value += 2.0 / 60.0;
        updatePlayer();
        updateEnemy(timeDelta);
        updateStars();
    }
    animate();


    


    function onDocumentKeyDown(event) {
        const x_speed=2;
        const y_speed=2; 
        console.log(event.key);
        var key = event.key;
        if ( key == 'ArrowUp') {
            player.model.position.z -= y_speed;
        } else if (key == 'ArrowDown') {
            player.model.position.z += y_speed;
        } else if (key == 'ArrowLeft') {
            player.model.position.x -= x_speed;
        } else if (key == 'ArrowRight') {
            player.model.position.x += x_speed;
        } else if (key == 'Control') {
            let missile = fire(player.model.position.toArray(),0xffff00);
            player.missiles.push(missile)
            scene.add(missile);
        } else if (key == 'Alt') {
            let missile = player.missiles.shift();
            scene.remove(missile);
        }
    }
// }

var missile_id
function fire(pos,mclr){
    const geometry = new THREE.CylinderGeometry( missileDimensions.rT,missileDimensions.rB,missileDimensions.h,missileDimensions.radSeg );
    const material = new THREE.MeshBasicMaterial( {color: mclr} );
    const cylinder = new THREE.Mesh( geometry, material );
    cylinder.position.set(pos[0],pos[1]-0.5,pos[2]);
    cylinder.rotation.x-=Math.PI/2;
    missile_id=cylinder.id;
    return cylinder
}

function render() {
    renderer.render(scene, camera);
  }

/*
things to remove that move out of frame, 
missiles,rocks, any other thing like islands

dont remove them after checking the frame, just take a 
treshold(max distance *2 of orbital controls), if any exceeds that remove it.




*/
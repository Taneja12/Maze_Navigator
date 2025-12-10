// Main Game Class - Optimized Version
class MazeGame {
    constructor() {
        // Game state
        this.level = 1;
        this.score = 0;
        this.startTime = Date.now();
        this.gameTime = 0;
        this.isGameOver = false;
        this.autoMode = false;
        this.lastFrameTime = 0;
        this.fps = 60;
        this.frameCount = 0;
        
        // Maze dimensions
        this.mazeSize = 10;
        this.maze = [];
        
        // Player
        this.player = {
            x: 0.5,
            y: 1,
            z: 0.5,
            rotation: 0,
            speed: 0.2
        };
        
        // Game objects
        this.walls = new THREE.Group();
        this.goal = null;
        this.zombies = [];
        this.bullets = [];
        
        // Optimized rendering
        this.renderDistance = 20;
        this.visibleWalls = new Set();
        
        // Controls
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        // Materials cache
        this.materials = {};
        this.geometries = {};
        
        // Initialize Three.js
        this.initThreeJS();
        
        // Generate maze
        this.generateMaze();
        
        // Start game loop
        this.gameLoop();
        
        // Setup controls
        this.setupControls();
        
        // Start timer
        this.updateTimer();
    }
    
    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 15, 30);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0.5, 1.5, 0.5);
        
        // Renderer with optimizations
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        // Simple Lighting (optimized)
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = false; // Disable shadows for performance
        this.scene.add(directionalLight);
        
        // Floor (simplified)
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x654321,
            roughness: 0.9,
            metalness: 0.1
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.scene.add(this.floor);
        
        // Simple sky
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Groups for organization
        this.scene.add(this.walls);
        
        // Minimap setup
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Pre-cache geometries
        this.preCacheGeometries();
    }
    
    preCacheGeometries() {
        // Wall geometry (instanced later)
        this.geometries.wall = new THREE.BoxGeometry(1, 2, 0.2); // Thin walls
        
        // Zombie geometry
        this.geometries.zombie = new THREE.CylinderGeometry(0.15, 0.15, 1, 8);
        
        // Bullet geometry
        this.geometries.bullet = new THREE.SphereGeometry(0.05, 4, 4);
        
        // Goal geometry
        this.geometries.goal = new THREE.SphereGeometry(0.3, 8, 8);
    }
    
    generateMaze() {
        // Initialize maze grid
        this.maze = [];
        for (let x = 0; x < this.mazeSize; x++) {
            this.maze[x] = [];
            for (let z = 0; z < this.mazeSize; z++) {
                this.maze[x][z] = 1; // 1 = wall, 0 = path
            }
        }
        
        // More open maze generation
        for (let x = 1; x < this.mazeSize - 1; x++) {
            for (let z = 1; z < this.mazeSize - 1; z++) {
                if (Math.random() > 0.4) {
                    this.maze[x][z] = 0;
                }
            }
        }
        
        // Ensure path from start to end
        this.carvePath(0, 0, this.mazeSize - 1, this.mazeSize - 1);
        
        // Ensure entrance and exit are clear
        this.maze[0][0] = 0;
        this.maze[this.mazeSize-1][this.mazeSize-1] = 0;
        this.maze[0][1] = 0;
        this.maze[1][0] = 0;
        this.maze[this.mazeSize-2][this.mazeSize-1] = 0;
        this.maze[this.mazeSize-1][this.mazeSize-2] = 0;
        
        // Create maze walls
        this.createOptimizedWalls();
        
        // Place goal
        this.placeGoal();
        
        // Place zombies
        this.placeZombies();
        
        // Set player position
        this.player.x = 0.5;
        this.player.z = 0.5;
        this.player.rotation = 0;
    }
    
    carvePath(startX, startZ, endX, endZ) {
        let x = startX;
        let z = startZ;
        
        while (x !== endX || z !== endZ) {
            this.maze[x][z] = 0;
            
            if (Math.random() > 0.5 && x !== endX) {
                x += (endX > x) ? 1 : -1;
            } else if (z !== endZ) {
                z += (endZ > z) ? 1 : -1;
            }
        }
        this.maze[endX][endZ] = 0;
    }
    
    createOptimizedWalls() {
        // Clear existing walls
        while (this.walls.children.length > 0) {
            this.walls.remove(this.walls.children[0]);
        }
        
        // Use instancing for better performance
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.8
        });
        
        // Only create walls that are actually visible
        for (let x = 0; x < this.mazeSize; x++) {
            for (let z = 0; z < this.mazeSize; z++) {
                if (this.maze[x][z] === 1) {
                    const wall = new THREE.Mesh(this.geometries.wall, wallMaterial);
                    wall.position.set(x, 1, z);
                    this.walls.add(wall);
                }
            }
        }
    }
    
    placeGoal() {
        // Remove existing goal
        if (this.goal) {
            this.scene.remove(this.goal);
        }
        
        // Create goal with cached geometry
        const goalMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00FF00
        });
        this.goal = new THREE.Mesh(this.geometries.goal, goalMaterial);
        this.goal.position.set(this.mazeSize - 0.5, 0.3, this.mazeSize - 0.5);
        this.scene.add(this.goal);
    }
    
    placeZombies() {
        // Remove existing zombies
        this.zombies.forEach(zombie => this.scene.remove(zombie.mesh));
        this.zombies = [];
        
        // Place zombies in random positions
        const zombieCount = Math.min(this.level + 1, 3); // Reduced for performance
        const zombieMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
        
        for (let i = 0; i < zombieCount; i++) {
            let x, z;
            do {
                x = Math.floor(Math.random() * (this.mazeSize - 2)) + 1;
                z = Math.floor(Math.random() * (this.mazeSize - 2)) + 1;
            } while (this.maze[x][z] === 1 || (x === 0 && z === 0));
            
            const zombie = new THREE.Mesh(this.geometries.zombie, zombieMaterial);
            zombie.position.set(x + 0.5, 0.5, z + 0.5);
            this.scene.add(zombie);
            
            this.zombies.push({
                mesh: zombie,
                x: x + 0.5,
                z: z + 0.5,
                speed: 0.01 + Math.random() * 0.01, // Slower for performance
                health: 1 // Less health for faster gameplay
            });
        }
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            if (e.key === 'r' || e.key === 'R') {
                this.restartGame();
            }
            
            if (e.key === ' ' && !this.isGameOver) {
                this.shoot();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Simplified mouse look
        let mouseLocked = false;
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
            mouseLocked = true;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (mouseLocked && !this.isGameOver) {
                this.player.rotation -= e.movementX * 0.002;
                this.camera.rotation.y = this.player.rotation;
            }
        });
        
        // Auto mode button
        document.getElementById('autoBtn').addEventListener('click', () => {
            this.autoMode = !this.autoMode;
            document.getElementById('autoBtn').textContent = 
                this.autoMode ? 'Manual Mode' : 'Auto Mode';
            if (this.autoMode) {
                this.autoPath = this.findPath(
                    Math.floor(this.player.x),
                    Math.floor(this.player.z),
                    this.mazeSize - 1,
                    this.mazeSize - 1
                );
            }
        });
        
        // Game over buttons
        document.getElementById('nextLevel').addEventListener('click', () => {
            this.nextLevel();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    updatePlayer() {
        if (this.isGameOver) return;
        
        const moveSpeed = this.player.speed;
        let newX = this.player.x;
        let newZ = this.player.z;
        
        if (this.autoMode && this.autoPath && this.autoPath.length > 1) {
            // Auto navigation
            const nextStep = this.autoPath[1];
            const targetX = nextStep.x + 0.5;
            const targetZ = nextStep.z + 0.5;
            
            const dx = targetX - this.player.x;
            const dz = targetZ - this.player.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0.1) {
                this.player.rotation = Math.atan2(dx, dz);
                newX += Math.sin(this.player.rotation) * moveSpeed;
                newZ += Math.cos(this.player.rotation) * moveSpeed;
            } else {
                this.autoPath.shift();
            }
        } else {
            // Manual controls
            if (this.keys['w']) {
                newX += Math.sin(this.player.rotation) * moveSpeed;
                newZ += Math.cos(this.player.rotation) * moveSpeed;
            }
            if (this.keys['s']) {
                newX -= Math.sin(this.player.rotation) * moveSpeed;
                newZ -= Math.cos(this.player.rotation) * moveSpeed;
            }
            if (this.keys['a']) {
                newX += Math.sin(this.player.rotation - Math.PI/2) * moveSpeed;
                newZ += Math.cos(this.player.rotation - Math.PI/2) * moveSpeed;
            }
            if (this.keys['d']) {
                newX += Math.sin(this.player.rotation + Math.PI/2) * moveSpeed;
                newZ += Math.cos(this.player.rotation + Math.PI/2) * moveSpeed;
            }
        }
        
        // Simple collision detection
        const gridX = Math.floor(newX);
        const gridZ = Math.floor(newZ);
        
        if (gridX >= 0 && gridX < this.mazeSize && 
            gridZ >= 0 && gridZ < this.mazeSize && 
            this.maze[gridX][gridZ] === 0) {
            this.player.x = newX;
            this.player.z = newZ;
        }
        
        // Update camera
        this.camera.position.set(this.player.x, this.player.y, this.player.z);
        this.camera.rotation.y = this.player.rotation;
        
        // Check goal collision
        const goalDistance = Math.sqrt(
            Math.pow(this.player.x - this.goal.position.x, 2) +
            Math.pow(this.player.z - this.goal.position.z, 2)
        );
        
        if (goalDistance < 0.5) {
            this.completeLevel();
        }
    }
    
    findPath(startX, startZ, endX, endZ) {
        // Simplified BFS for performance
        const queue = [{x: startX, z: startZ, path: [{x: startX, z: startZ}]}];
        const visited = new Set();
        visited.add(`${startX},${startZ}`);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.x === endX && current.z === endZ) {
                return current.path;
            }
            
            const neighbors = [
                {x: current.x + 1, z: current.z},
                {x: current.x - 1, z: current.z},
                {x: current.x, z: current.z + 1},
                {x: current.x, z: current.z - 1}
            ];
            
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.z}`;
                
                if (neighbor.x >= 0 && neighbor.x < this.mazeSize &&
                    neighbor.z >= 0 && neighbor.z < this.mazeSize &&
                    this.maze[neighbor.x][neighbor.z] === 0 &&
                    !visited.has(key)) {
                    
                    visited.add(key);
                    queue.push({
                        x: neighbor.x,
                        z: neighbor.z,
                        path: [...current.path, {x: neighbor.x, z: neighbor.z}]
                    });
                }
            }
        }
        
        return null;
    }
    
    updateZombies() {
        // Only update zombies near player
        const updateDistance = 10;
        
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            const dx = this.player.x - zombie.x;
            const dz = this.player.z - zombie.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Only update if zombie is close
            if (distance < updateDistance) {
                if (distance > 0.5 && distance < 5) {
                    zombie.x += (dx / distance) * zombie.speed;
                    zombie.z += (dz / distance) * zombie.speed;
                    zombie.mesh.position.set(zombie.x, 0.5, zombie.z);
                }
                
                // Check collision
                if (distance < 0.7) {
                    this.gameOver(false);
                }
            }
        }
    }
    
    shoot() {
        // Limit shooting rate
        if (this.lastShot && Date.now() - this.lastShot < 300) return;
        this.lastShot = Date.now();
        
        // Simple shooting - just check for immediate hits
        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            const dx = zombie.x - this.player.x;
            const dz = zombie.z - this.player.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const angleToZombie = Math.atan2(dx, dz);
            const angleDiff = Math.abs(angleToZombie - this.player.rotation);
            
            if (distance < 3 && angleDiff < 0.3) {
                this.scene.remove(zombie.mesh);
                this.zombies.splice(i, 1);
                this.score += 100;
                this.updateUI();
                break; // Only hit one zombie per shot
            }
        }
    }
    
    updateMinimap() {
        const ctx = this.minimapCtx;
        const size = this.minimapCanvas.width;
        const cellSize = size / this.mazeSize;
        
        // Clear with single fill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, size, size);
        
        // Draw all cells at once
        ctx.fillStyle = '#654321';
        for (let x = 0; x < this.mazeSize; x++) {
            for (let z = 0; z < this.mazeSize; z++) {
                if (this.maze[x][z] === 0) {
                    ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize);
                }
            }
        }
        
        // Draw walls
        ctx.fillStyle = '#8B4513';
        for (let x = 0; x < this.mazeSize; x++) {
            for (let z = 0; z < this.mazeSize; z++) {
                if (this.maze[x][z] === 1) {
                    ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize);
                }
            }
        }
        
        // Draw grid (simplified)
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        for (let i = 0; i <= this.mazeSize; i++) {
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, size);
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(size, i * cellSize);
        }
        ctx.stroke();
        
        // Draw goal
        ctx.fillStyle = '#0F0';
        ctx.beginPath();
        ctx.arc(
            (this.mazeSize - 0.5) * cellSize,
            (this.mazeSize - 0.5) * cellSize,
            cellSize * 0.3,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Draw player
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(
            this.player.x * cellSize,
            this.player.z * cellSize,
            cellSize * 0.25,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    updateTimer() {
        if (!this.isGameOver) {
            this.gameTime = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
            const seconds = (this.gameTime % 60).toString().padStart(2, '0');
            document.getElementById('timer').textContent = `${minutes}:${seconds}`;
            
            this.score = Math.max(0, 1000 * this.level - this.gameTime * 10);
            this.updateUI();
            
            setTimeout(() => this.updateTimer(), 1000);
        }
    }
    
    updateUI() {
        document.getElementById('level').textContent = this.level;
        document.getElementById('score').textContent = this.score;
    }
    
    completeLevel() {
        this.isGameOver = true;
        document.getElementById('gameOverText').textContent = 'Level Complete!';
        document.getElementById('gameOverStats').textContent = 
            `Time: ${document.getElementById('timer').textContent} | Score: ${this.score}`;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    gameOver(success) {
        this.isGameOver = true;
        document.getElementById('gameOverText').textContent = 
            success ? 'You Win!' : 'Game Over!';
        document.getElementById('gameOverStats').textContent = 
            `Time: ${document.getElementById('timer').textContent} | Score: ${this.score}`;
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('nextLevel').style.display = success ? 'inline-block' : 'none';
    }
    
    nextLevel() {
        this.level++;
        this.isGameOver = false;
        document.getElementById('gameOver').style.display = 'none';
        this.startTime = Date.now();
        this.updateTimer();
        
        // Slightly increase difficulty
        this.mazeSize = Math.min(12, 10 + this.level);
        this.player.speed = 0.2 + (this.level * 0.01);
        
        this.generateMaze();
    }
    
    restartGame() {
        this.level = 1;
        this.score = 0;
        this.isGameOver = false;
        document.getElementById('gameOver').style.display = 'none';
        this.mazeSize = 10;
        this.player.speed = 0.2;
        this.startTime = Date.now();
        this.updateTimer();
        this.generateMaze();
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    gameLoop(currentTime = 0) {
        // Calculate delta time for consistent movement
        const deltaTime = Math.min((currentTime - this.lastFrameTime) / 16.67, 2);
        this.lastFrameTime = currentTime;
        
        if (!this.isGameOver) {
            this.updatePlayer();
            
            // Update zombies every other frame
            if (this.frameCount % 2 === 0) {
                this.updateZombies();
            }
        }
        
        // Update minimap every 3 frames
        if (this.frameCount % 3 === 0) {
            this.updateMinimap();
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        this.frameCount++;
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Start the game
window.addEventListener('load', () => {
    new MazeGame();
});

(function () {
    var previousTime = 0.0;
    var bounce_damp = 0.5;
    var roll_damp = 1 - 0.02;
    var air_damp = 1 - 0.000;
    var ball_w = 80; var ball_h = ball_w;
    const ballR = ball_w/2;

    var goal_w = 150;
    var goal_h = 50;
    var goal_x = document.body.clientWidth - 350;
    var goal_y = 200;

    var rim_w = 30;
    var rim_front_h = goal_h; var rim_back_h = goal_h * 3;
    var rim_front_x = goal_x - rim_w; var rim_front_y = goal_y;
    var rim_back_x = goal_x + goal_w; var rim_back_y = goal_y;

    var goals = document.getElementsByClassName('goal');
    for (var gi = 0; gi < goals.length; gi++) {
        var g = goals[gi];
        g.style.width = goal_w + 'px';
        g.style.height = goal_h + 'px';
        g.style.left = goal_x + 'px';
        g.style.bottom = goal_y + 'px';
        var r = document.createElement("div");
        r.className = 'rim';
        r.style.width = rim_w + 'px';
        r.style.height = rim_front_h + 'px';
        r.style.left = rim_front_x + 'px';
        r.style.bottom = rim_front_y + 'px';
        document.body.appendChild(r);
        var b = document.createElement("div");
        b.className = 'backboard';
        b.style.width = rim_w + 'px';
        b.style.height = rim_back_h + 'px';
        b.style.left = rim_back_x + 'px';
        b.style.bottom = rim_back_y + 'px';
        document.body.appendChild(b);
    }
    var ballNumber = 1;
    function addBall(x, y) {
        var n = document.createElement("div");
        var s = document.createElement("span");
        n.appendChild(s);
        n.className = 'ball';
        n.style.width = ball_w + 'px';
        n.style.height = ball_h + 'px';
        n.style.left = x + 'px';
        n.style.bottom = y + 'px';
        n.dataset['x'] = x;
        n.dataset['y'] = y;
        n.dataset['ttl'] = 10000;
        n.dataset['number'] = ballNumber++;

        document.body.appendChild(n);
        return n;
    }

    // `beep` was taken from Stack Overflow since it's more of a library reference on AudioContext
    //if you have another AudioContext class use that one, as some browsers have a limit
    var audioCtx = new (window.AudioContext || window.webkitAudioContext || window.audioContext);
    //All arguments are optional:
    //duration of the tone in milliseconds. Default is 500
    //frequency of the tone in hertz. default is 440
    //volume of the tone. Default is 1, off is 0.
    //type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
    //callback to use on end of tone
    function beep(duration, frequency, volume, type, callback) {
        var oscillator = audioCtx.createOscillator();
        var gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (volume){gainNode.gain.value = volume;}
        if (frequency){oscillator.frequency.value = frequency;}
        if (type){oscillator.type = type;}
        if (callback){oscillator.onended = callback;}

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + ((duration || 500) / 1000));
    };
    function checkFloorAndWalls(x, y, vel_x, vel_y, dt) {
        if (y <= 0) {
            if (vel_y > bounce_damp / 2)
                vel_y = -vel_y * bounce_damp;
            else
                vel_y = 0;
            vel_x *= roll_damp;
        } else {
            vel_y += dt / 1000 * 40; //gravity
            vel_x *= air_damp;
            vel_y *= air_damp;
        }
        if (vel_x > 0 && x >= document.body.clientWidth - 90) {
            if (vel_x > bounce_damp)
                vel_x = -vel_x * bounce_damp;
            else
                vel_x = 0;
        } else if (x < 0) {
            vel_x = 0;
        }
        return {
            vel_x: vel_x,
            vel_y: vel_y
        }
    }
    function point_inside_rect(x, y, rectX, rectY, rectW, rectH){
        return x >= rectX &&
        y >= rectY &&
        y <= rectY + rectH && 
        x <= rectX + rectW;
    }
    //unused, and currently wrong, couldn't figure it out fast enough
    function rect_inside_rect(x, y, w, h, rectX, rectY, rectW, rectH){
        var offX = x - rectX;
        var offY = y - rectY;
        return (
            (x >= rectX && x <= rectX+rectW && y+h >= rectY && y+h <= rectY+rectH)    
        );
    }
    /**
     * distance theorem from point a x,y to point b x,y 
     * @param {*} x 
     * @param {*} y 
     * @param {*} bX 
     * @param {*} bY 
     */
    function distance(x, y, bX, bY){
        return (Math.sqrt(
            Math.pow(x - bX, 2) +
            Math.pow(y - bY, 2)
        ));
    }
    /**
     * returns true if x/y hits any point within min/max X/Y
     * 
     * note: this actually models a cylindrical rim, not a square
     * @param {*} x 
     * @param {*} y 
     * @param {*} minX 
     * @param {*} maxX 
     * @param {*} minY 
     * @param {*} maxY 
     */
    function intersection(x, y, minX, maxX, minY, maxY){
        //find the closest point on the rim by "clamping"
        var rimX = Math.min(maxX, Math.max(minX, x));
        var rimY = Math.min(maxY, Math.max(minY, y));
        //then return distance < ballR
        return distance(x, y, rimX, rimY) <= ballR;
    }
    function collideWithRim(ballX, ballY, rimX, rimY, rimW, rimH){
        return (
            //an "optimization" would be to check rect_inside_rect(ballX, ballY, ball_h, ball_h, rimX, rimY, rimW, rimH) BEFORE
            //calling the distance code, since distance code is "expensive"
            //but in the interest of time, we'll just run distance each time
            intersection(ballX+ballR, ballY+ballR, rimX, rimX+rimW, rimY, rimY+rimH)
        )
    }
    function checkRimCollisions(ballX, ballY, vel_x, vel_y, allowRecurse) {
        //available dimensions:
        // ball_w, ball_h
        // rim_w
        // rim_front_h, rim_front_x, rim_front_y
        // rim_back_h, rim_back_x, rim_back_y

        // ball has a radius of ball_w/2
        // ballX and ballY are the bottom-left corner of the ball
        // ballX and ballY are the PAST version of the ball
        // vel_x will be ADDED to ballX and and vel_y will be SUBTRACTED to ballY after this function

        if (collideWithRim(ballX + vel_x, ballY - vel_y, rim_front_x, rim_front_y, rim_w, rim_front_h) ||
            collideWithRim(ballX + vel_x, ballY - vel_y, rim_back_x, rim_back_y, rim_w, rim_back_h)
        ){
            beep(100, 80+(Math.random()*5)*5, 0.2, 'square');// collision sfx
            vel_x *= -1;
            vel_y *= -1;
        }

        return {
            vel_x: vel_x,
            vel_y: vel_y
        }
    }
    function checkGoal(ballX, ballY, ballHW) {
        // available dimensions:
        // goal_w, goal_h
        // goal_x, goal_y

        //checks that the top-center of the ball is in the goal
        return point_inside_rect(ballX + ballR, ballY + ballR*2, goal_x, goal_y, goal_w, goal_h);
    }
    var scored = {};
    var scoreboard = document.getElementsByClassName('scoreboard')[0];
    var juice = document.getElementsByClassName('juice')[0];
    var juiceTimeout = null;
    var phrases = ["SCORE!", "SWISH!", "YOU ROCK!", "2 POINTS!", "BOOM GOES THE DYNAMITE","DOWNTOWN!", "ALLEY OOP!"]
    function onGoal(ballNumber) {
        if (!scored[ballNumber]){
            scored[ballNumber] = true;
            scoreboard.innerText = Object.keys(scored).length * 2;
            juice.children[0].innerText = phrases[Math.floor(Math.random()*phrases.length)];
            juice.classList.add('active');
            if (juiceTimeout)
                window.clearTimeout(juiceTimeout);
            juiceTimeout = setTimeout(function(){
                juice.classList.remove('active');
            }, 3000);
            
            beep(200, 600, 0.3, null, function(){
                beep(200, 700, 0.3, null, function(){
                    beep(200, 800, 0.3, null, function(){
                        beep(400, 900, 0.3, null, function(){
                            beep(120, 800, 0.3, null, function(){
                                beep(1000, 900, 0.3)
                            })
                        })
                    })
                })
            });
        }
    }
    function loop(time) {
        // Compute the delta-time against the previous time
        var dt = time - previousTime;

        // Update the previous time
        previousTime = time;

        var balls = document.getElementsByClassName('ball');
        for (var h = balls.length - 1; h > -1; h--) {
            if (+balls[h].dataset['ttl'] < 0) {
                balls[h].dataset['physics'] = 'false';
                document.body.removeChild(balls[h]);
            }
        }
        for (var i = 0; i < balls.length; i++) {
            var ball = balls[i];
            if (ball.dataset['physics'] == 'false')
                continue;
            var vel_y = +ball.dataset['vy'] || 0;
            var vel_x = +ball.dataset['vx'] || 0;
            var x = +ball.dataset['x'] || 0;
            var y = +ball.dataset['y'] || 0;

            var sys = checkFloorAndWalls(x, y, vel_x, vel_y, dt)
            vel_x = sys.vel_x;
            vel_y = sys.vel_y;

            vel_x = Math.min(vel_x, 20);
            vel_y = Math.min(vel_y, 20);

            var rim_c = checkRimCollisions(x, y, vel_x, vel_y);
            vel_x = rim_c.vel_x;
            vel_y = rim_c.vel_y;

            x += vel_x;
            y -= vel_y;
            if (checkGoal(x, y, ball_w)) {
                onGoal(+ball.dataset['number']);
            }
            ball.style.bottom = y + 'px';
            ball.style.left = x + 'px';
            ball.children[0].innerText = vel_x.toFixed(2) + ',' + vel_y.toFixed(2);
            ball.dataset['x'] = x;
            ball.dataset['vx'] = vel_x;
            ball.dataset['y'] = y;
            ball.dataset['vy'] = vel_y;
            ball.dataset['ttl'] = (+ball.dataset['ttl']) - dt;

        }
        window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(function (time) {
        previousTime = time;
        window.requestAnimationFrame(loop);
    });
    var sling_ball = null; var move_ball = null; var move_start = {};
    var sling_start_x = 0; var sling_start_y = 0;

    document.addEventListener('mousedown', function (e) {
        if (e.button == 0){
            sling_ball = addBall(165, 170);
            sling_ball.dataset['physics'] = false;
            sling_start_x = e.pageX; sling_start_y = e.pageY;
        }
        if (e.button == 1){
            var balls = document.getElementsByClassName('ball');
            for (var i = 0; i < balls.length; i++) {
                var ball = balls[i];
                if (point_inside_rect(e.pageX, document.body.clientHeight- e.pageY, +ball.dataset.x, +ball.dataset.y, ball_h, ball_h)){
                    move_ball = ball;
                    ball.dataset.physics = 'false';
                    break;
                }
            }
        }
    });
    var drag_scale = 7; //for every 7px, add 1 force
    var max_sling_f = 30; // max sling force
    document.addEventListener('mousemove', function (e) {
        if (sling_ball) {
            var x = sling_start_x - e.pageX;
            var y = sling_start_y - e.pageY;
            x /= drag_scale; y /= drag_scale;
            x = Math.min(max_sling_f, Math.max(-max_sling_f, x));
            y = Math.min(max_sling_f, Math.max(-max_sling_f, y));
            sling_ball.dataset['x'] = 170 - x * 2;
            sling_ball.dataset['y'] = 170 + y * 2;
            sling_ball.style.left = sling_ball.dataset['x'] + 'px';
            sling_ball.style.bottom = sling_ball.dataset['y'] + 'px';
            sling_ball.dataset['vx'] = x;
            sling_ball.dataset['vy'] = y;
            sling_ball.children[0].innerText = x.toFixed(2) + ',' + y.toFixed(2);
        } else if (move_ball){
            var x = e.pageX;
            var y = document.body.clientHeight-e.pageY;
            move_ball.style.left = x;
            move_ball.style.bottom = y;
            move_ball.dataset.x = x;
            move_ball.dataset.y = y;
            move_ball.classList.toggle('collide', checkRimCollisions(x, y, 1, 1).vel_x == -1);
        }
    });
    document.addEventListener('mouseup', function (e) {
        if (e.button == 0){
            sling_ball.dataset['physics'] = true;
            sling_ball = null;
        }
        if (e.button == 1 && move_ball){
            move_ball.dataset.physics = true;
            move_ball = null;
        }
    });
})();
#![allow(missing_docs)]

use basegl::display::camera::Camera2d;
use basegl::display::navigation::navigator::Navigator;
use basegl::display::object::DisplayObject;
use basegl::display::object::DisplayObjectOps;
use basegl::display::symbol::geometry::Sprite;
use basegl::display::symbol::geometry::SpriteSystem;
use basegl::display::world::*;
use basegl::prelude::*;
use basegl::system::web::forward_panic_hook_to_console;
use basegl::system::web::set_stdout;
use basegl::system::web;
use nalgebra::Vector2;
use nalgebra::Vector3;
use wasm_bindgen::prelude::*;


#[wasm_bindgen]
#[allow(dead_code)]
pub fn run_example_sprite_system() {
    forward_panic_hook_to_console();
    set_stdout();
    init(&WorldData::new(&web::body()));
}

fn init(world:&World) {
    let scene         = world.scene();
    let camera        = scene.camera()  ;
    let navigator     = Navigator::new(&scene,&camera).expect("Couldn't create navigator");
    let sprite_system = SpriteSystem::new(world);
    let sprite1       = sprite_system.new_instance();
    sprite1.size().set(Vector2::new(10.0, 10.0));
    sprite1.mod_position(|t| *t = Vector3::new(5.0, 5.0, 0.0));

    world.add_child(&sprite_system);

    let mut sprites: Vec<Sprite> = default();
    let count = 100;
    for _ in 0 .. count {
        let sprite = sprite_system.new_instance();
        sprites.push(sprite);
    }

    let mut iter:i32 = 0;
    world.on_frame(move |time_ms| {
        let _keep_alive = &navigator;
        on_frame(&camera,*time_ms,&mut iter,&sprite1,&mut sprites,&sprite_system)
    }).forget();
}

#[allow(clippy::too_many_arguments)]
#[allow(clippy::many_single_char_names)]
pub fn on_frame
( camera        : &Camera2d
, time          : f64
, iter          : &mut i32
, sprite1       : &Sprite
, sprites       : &mut Vec<Sprite>
, sprite_system : &SpriteSystem) {
    *iter += 1;

    let cycle_duration        = 300;
    let pause_duration        = 100;
    let sprite_diff_per_cycle = 100;

    let mut frozen = false;

    if *iter < cycle_duration {
        for _ in 0..sprite_diff_per_cycle {
            let sprite = sprite_system.new_instance();
            sprites.push(sprite);
        }
    } else if *iter < pause_duration + cycle_duration {
        sprite1.mod_position(|p| p.y += 0.5);
        frozen = true;
    } else if *iter < pause_duration + (cycle_duration * 2) {
        for _ in 0..sprite_diff_per_cycle {
            sprites.pop();
        }
    } else {
        *iter = 0;
        *sprites = default();
    }

    let screen = camera.screen();
    let half_width = screen.width / 2.0;
    let half_height = screen.height / 2.0;

    if !frozen {
        let t = time as f32 / 1000.0;
        let length = sprites.len() as f32;
        for (i, sprite) in sprites.iter_mut().enumerate() {
            let i = i as f32;
            let d = (i / length - 0.5) * 2.0;

            let mut y = d;
            let r = (1.0 - y * y).sqrt();
            let mut x = (y * 100.0 + t).cos() * r;
            let mut z = (y * 100.0 + t).sin() * r;

            x += (y * 1.25 + t * 2.50).cos() * 0.5;
            y += (z * 1.25 + t * 2.00).cos() * 0.5;
            z += (x * 1.25 + t * 3.25).cos() * 0.5;

            let position = Vector3::new(x * 150.0 + half_width, y * 150.0 + half_height, z * 150.0);
            sprite.set_position(position);
        }
    }

    sprite_system.display_object().update();
}

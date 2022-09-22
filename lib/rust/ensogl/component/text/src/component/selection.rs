//! Provides a text cursor and selection component.

use crate::prelude::*;
use ensogl_core::display::shape::*;

use enso_frp as frp;
use ensogl_core::application::command::FrpNetworkProvider;
use ensogl_core::data::color;
use ensogl_core::display;
use ensogl_core::system::gpu::shader::glsl::traits::IntoGlsl;
use ensogl_core::system::web;
use ensogl_core::system::web::traits::*;
use ensogl_core::Animation;
// FIXME: circular dep?
use crate::font::glyph::WeakGlyph;

pub use crate::buffer::view::selection::Id;



// =============
// === Shape ===
// =============

const CURSOR_PADDING: f32 = 4.0;
const CURSOR_WIDTH: f32 = 2.0;
const CURSOR_ALPHA: f32 = 0.8;
const CURSORS_SPACING: f32 = 1.0;
const SELECTION_ALPHA: f32 = 0.3;
const SELECTION_CORNER_RADIUS: f32 = 2.0;
const BLINK_SLOPE_IN_DURATION: f32 = 200.0;
const BLINK_SLOPE_OUT_DURATION: f32 = 200.0;
const BLINK_ON_DURATION: f32 = 300.0;
const BLINK_OFF_DURATION: f32 = 300.0;
const BLINK_PERIOD: f32 =
    BLINK_SLOPE_IN_DURATION + BLINK_SLOPE_OUT_DURATION + BLINK_ON_DURATION + BLINK_OFF_DURATION;

/// Text cursor and selection shape definition. If the shape is narrow, it is considered a cursor,
/// and thus, it blinks.
///
/// ## Blinking Implementation
///
/// The blinking alpha is a time-dependent function which starts as a fully opaque value and
/// changes periodically. The `start_time` parameter is set to the current time after each cursor
/// operation, which makes cursor visible during typing and after position change.
///
/// ```compile_fail
/// |
/// |    on         off
/// | <------>   <------->
/// | --------.             .--------.             .-...
/// |          \           /          \           /
/// |           '---------'            '---------'
/// |         <->         <->
/// |      slope_out   slope_in
/// |                                              time
/// |-------------------------------------------------->
/// start time
/// ```
///
/// The [`not_blinking`] parameter can be used to disable blinking. When set to 0, blinking is
/// enabled.
pub mod shape {
    use super::*;

    ensogl_core::define_shape_system! {
        pointer_events = false;
        (style:Style, selection:f32, start_time:f32, not_blinking:f32, color_rgb:Vector3<f32>) {
            let width_abs = Var::<f32>::from("abs(input_size.x)");
            let height = Var::<f32>::from("input_size.y");
            let rect_width = width_abs - 2.0 * CURSOR_PADDING;
            let rect_height = height - 2.0 * CURSOR_PADDING;
            let time = Var::<f32>::from("input_time");
            let one = Var::<f32>::from(1.0);
            let time = time - start_time;
            let on_time = BLINK_ON_DURATION + BLINK_SLOPE_OUT_DURATION;
            let off_time = on_time + BLINK_OFF_DURATION;
            let sampler = time % BLINK_PERIOD;
            let slope_out = sampler.smoothstep(BLINK_ON_DURATION, on_time);
            let slope_in = sampler.smoothstep(off_time, BLINK_PERIOD);
            let blinking_alpha = (one - slope_out + slope_in) * CURSOR_ALPHA;
            let alpha = not_blinking.mix(blinking_alpha, SELECTION_ALPHA);
            let shape = Rect((1.px() * rect_width,1.px() * rect_height));
            let shape = shape.corners_radius(SELECTION_CORNER_RADIUS.px());
            let rgb = color_rgb;
            let color = format!("srgba({}.x,{}.y,{}.z,{})", rgb, rgb, rgb,alpha.glsl());
            let shape = shape.fill(color);
            shape.into()
        }
    }
}



// ===========
// === FRP ===
// ===========

ensogl_core::define_endpoints_2! {
    Input {
        set_color (color::Rgb),
        set_ascender (f32),
        set_descender (f32),
        set_attached_glyphs (Rc<Vec<WeakGlyph>>),
        set_width (f32),
        set_position_target (Vector2),
        skip_position_animation(),
        skip_width_animation(),
    }

    Output {
        /// Current position, animated.
        position (Vector2),
        /// Current width, animated.
        width (f32),
        /// Position value, animation target.
        position_target (Vector2),
        /// Width value, animation target.
        width_target (f32),
        right_side_of_last_attached_glyph (f32),
    }
}



// =================
// === Selection ===
// =================

/// Visual representation of text cursor and text selection.
///
/// ## Implementation Notes
/// Selection contains a `right_side` display object which is always placed on its right side. It is
/// used for smooth glyph animation. For example, after several glyphs were selected and removed,
/// the selection will gradually shrink. Making all following glyphs children of the `right_side`
/// object will make the following glyphs animate while the selection is shrinking.
#[derive(Clone, CloneRef, Deref)]
pub struct Selection {
    #[deref]
    frp:   Frp,
    model: SelectionModel,
}

impl Debug for Selection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Selection")
    }
}

impl Selection {
    /// Accessor.
    pub fn edit_mode(&self) -> &Rc<Cell<bool>> {
        &self.model.edit_mode
    }

    /// Accessor.
    pub fn right_side(&self) -> &display::object::Instance {
        &self.model.right_side
    }

    /// Constructor.
    pub fn new(edit_mode: bool) -> Self {
        let spring_factor = if crate::DEBUG_ANIMATION_SLOWDOWN { 0.1 } else { 1.0 };

        let frp = Frp::new();
        let network = frp.network();
        let model = SelectionModel::new(edit_mode);
        let position = Animation::new(&network);
        let width = Animation::new(&network);
        let ascender = Animation::new(&network);
        let descender = Animation::new(&network);
        let not_blinking = Animation::<f32>::new(&network);

        position.simulator.update_spring(|spring| spring * spring_factor);
        width.simulator.update_spring(|spring| spring * spring_factor);

        frp::extend! { network

            // === Height computation ===

            ascender.target <+ frp.set_ascender;
            descender.target <+ frp.set_descender;
            _eval <- all_with(&ascender.value, &descender.value,
                f!([model](ascender,descender) {
                    let height = ascender - descender;
                    model.view.set_position_y(height / 2.0 + descender);
                    model.view.size.modify(|t| Vector2(t.x, CURSOR_PADDING * 2.0 + height));
                })
            );

            // === Right side of last glyph computation ===

            on_position_or_glyphs_change <- any_(&frp.set_attached_glyphs, &position.value);
            changed_glyphs <- frp.set_attached_glyphs.sample(&on_position_or_glyphs_change);
            rhs_last_glyph <- changed_glyphs.map(f!([model](glyphs) {
                if let Some(glyph) = glyphs.last().and_then(|glyph| glyph.upgrade()) {
                    let glyph_right_x = glyph.position().x + glyph.x_advance.get();
                    let origin_x = model.display_object.position().x + model.right_side.position().x;
                    origin_x + glyph_right_x
                } else {
                    0.0
                }
            }));
            frp.private.output.right_side_of_last_attached_glyph <+ rhs_last_glyph.on_change();


            // === Width ===

            width.target <+ frp.input.set_width;
            width.skip <+ frp.skip_width_animation;
            frp.private.output.width_target <+ frp.input.set_width;
            frp.private.output.width <+ width.value;
            not_blinking.target <+ width.value.map(|v:&f32| if *v == 0.0 { 0.0 } else { 1.0 });
            eval not_blinking.value ((v) model.view.not_blinking.set(*v));


            // === Position ===

            position.target <+ frp.input.set_position_target;
            position.skip <+ frp.skip_position_animation;
            frp.private.output.position_target <+ frp.input.set_position_target;
            frp.private.output.position <+ position.value;
            eval_ frp.input.set_position_target (model.reset_blinking_animation_to_current_time());


            // === Updating Display Object ===

            _eval <- all_with(&position.value, &width.value,
                f!([model](p,width){
                    let side       = width.signum();
                    let abs_width  = width.abs();
                    let width      = max(CURSOR_WIDTH, abs_width - CURSORS_SPACING);
                    let view_width = CURSOR_PADDING * 2.0 + width;
                    let view_x     = (abs_width/2.0) * side;
                    model.display_object.set_position_xy(*p);
                    model.right_side.set_position_x(abs_width/2.0);
                    model.view.size.modify(|t| Vector2(view_width,t.y));
                    model.view.set_position_x(view_x);
                })
            );
            eval frp.set_color((color) model.view.color_rgb.set(color.into()));
        }

        Self { frp, model }
    }

    pub fn flip_sides(&self) {
        let width = self.frp.width_target.value();
        self.frp.set_position_target(self.frp.position.value() + Vector2(width, 0.0));
        self.frp.skip_position_animation();
        self.frp.set_position_target(self.frp.position_target.value() + Vector2(width, 0.0));

        self.frp.set_width(-self.frp.width.value());
        self.frp.skip_width_animation();
        self.frp.set_width(-self.frp.width_target.value());
    }
}

impl display::Object for Selection {
    fn display_object(&self) -> &display::object::Instance {
        &self.model.display_object
    }
}



// ======================
// === SelectionModel ===
// ======================

#[derive(Clone, CloneRef)]
pub struct SelectionModel {
    view:           shape::View,
    display_object: display::object::Instance,
    right_side:     display::object::Instance,
    edit_mode:      Rc<Cell<bool>>,
    timer:          web::Performance,
}

impl SelectionModel {
    pub fn new(edit_mode: bool) -> Self {
        let view = shape::View::new();
        let display_object = display::object::Instance::new();
        let right_side = display::object::Instance::new();
        let edit_mode = Rc::new(Cell::new(edit_mode));
        let timer = web::window.performance_or_panic();

        display_object.add_child(&view);
        display_object.add_child(&right_side);

        Self { view, display_object, right_side, edit_mode, timer }
    }
}

impl SelectionModel {
    pub fn reset_blinking_animation_to_current_time(&self) {
        let time = self.timer.now() as f32;
        self.view.start_time.set(time)
    }
}

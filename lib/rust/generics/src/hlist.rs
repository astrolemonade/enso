//! [`HList`] provides many operations to create and manipulate heterogenous lists whose length
//! and element types are known at compile-time. [`HLists`] can be used to implement records,
//! variants, type-indexed products (TIP), type-indexed co-products (TIC), or keyword arguments.
//!
//! Each [`HList`] is encoded using [`Cons`] and [`Nil`]. For example, a two-element [`HList`] can
//! be encoded as `Cons(A,Cons(B,Nil))`. You can use the provided [`new`], [`pat`] and [`ty`] macros
//! to easily work with HLists, for example:  
//! ```text
//! let HList::pat![t1, t2] : HList::ty![&str, usize] = HList::new!["hello", 7];
//! ```

pub mod traits {
    pub use super::AsHList as _TRAIT_AsHList;
    pub use super::AsHListMut as _TRAIT_AsHListMut;
    pub use super::HasHListRepr as _TRAIT_HasRepr;
    pub use super::IntoHList as _TRAIT_IntoHList;
}



// =============
// === HList ===
// =============

/// Type of every `HList`.
pub trait HList = crate::HasFieldCount;

/// Empty `HList` value.
#[derive(Debug, Clone, Copy)]
pub struct Nil;

/// Non-empty `HList` with head and tail.
#[derive(Debug, Clone, Copy)]
#[allow(missing_docs)]
pub struct Cons<Head, Tail>(pub Head, pub Tail);



// === Smart Constructors ===

/// Creates new `HList` from the provided elements, similar to `vec!`. In order to provide type for
/// the list, use the `ty` macro. In order to pattern match on it, use the `pat` macro.
///
/// ```text
/// let HList::pat![t1,t2] : HList::ty![&str,usize] = HList::new!["hello",7];
/// ```
#[macro_export]
macro_rules! new {
    ($(,)*) => { $crate::Nil };
    ($t:expr $(,$ts:expr)* $(,)?) => {
        $crate::Cons($t, $crate::new!{ $($ts),* })
    }
}

/// Pattern matches on a `HList`. See docs of `new` to learn more.
#[macro_export]
macro_rules! pat {
    ($(,)*) => { $crate::Nil };
    ($t:pat $(,$ts:pat)* $(,)?) => {
        $crate::Cons($t, $crate::pat!{ $($ts),* })
    }
}

/// Smart `HList` type constructor. See docs of `new` to learn more.
#[macro_export]
macro_rules! ty {
    ($(,)*) => { $crate::Nil };
    ($t:ty $(,$ts:ty)* $(,)?) => {
        $crate::Cons<$t, $crate::ty!{ $($ts),* }>
    }
}



// ====================
// === HasHListRepr ===
// ====================

/// A generic representation of the given type. This is a [`HList`] representation of all struct
/// fields.
pub trait HasHListRepr {
    type HListRepr: HList;
}

impl<'t, 's, T> HasHListRepr for &'t &'s T
where &'s T: HasHListRepr
{
    type HListRepr = <&'s T as HasHListRepr>::HListRepr;
}

/// A generic representation of the given type. This is a [`HList`] representation of all struct
/// fields.
pub type HListRepr<T> = <T as HasHListRepr>::HListRepr;



// =================
// === IntoHList ===
// =================

/// Converts the struct into its generic representation. Please note that this trait is implemented
/// automatically for every type which implements `Into<HListRepr<Self>>`.
pub trait IntoHList: HasHListRepr + Into<HListRepr<Self>> {
    #[inline(always)]
    fn into_hlist(self) -> HListRepr<Self> {
        self.into()
    }
}
impl<T: HasHListRepr + Into<HListRepr<T>>> IntoHList for T {}



// ===============
// === AsHList ===
// ===============

pub trait AsHList
where for<'t> &'t Self: HasHListRepr + Into<HListRepr<&'t Self>> {
    #[inline(always)]
    fn as_hlist(&self) -> HListRepr<&Self> {
        self.into()
    }
}
impl<T> AsHList for T where for<'t> &'t T: HasHListRepr + Into<HListRepr<&'t T>> {}



// ==================
// === AsHListMut ===
// ==================

pub trait AsHListMut
where for<'t> &'t mut Self: HasHListRepr + Into<HListRepr<&'t mut Self>> {
    #[inline(always)]
    fn as_hlist_mut(&mut self) -> HListRepr<&mut Self> {
        self.into()
    }
}
impl<T> AsHListMut for T where for<'t> &'t mut T: HasHListRepr + Into<HListRepr<&'t mut T>> {}



// // ==============
// // === Length ===
// // ==============
//
// /// Compile-time known length value.
// #[allow(missing_docs)]
// pub trait HasConstLength {
//     const LEN: usize;
//     #[inline(always)]
//     fn len() -> usize {
//         Self::LEN
//     }
// }
//
// /// Compile-time known length value.
// ///
// /// This function is defined only because currently, Rust does not allow const functions as trait
// /// members.
// #[inline(always)]
// pub const fn const_len<T: HasConstLength>() -> usize {
//     <T as HasConstLength>::LEN
// }
//
// impl HasConstLength for Nil {
//     const LEN: usize = 0;
// }
//
// impl<H, T: HasConstLength> HasConstLength for Cons<H, T> {
//     const LEN: usize = 1 + const_len::<T>();
// }



// ============
// === Head ===
// ============

/// Head element accessor.
#[allow(missing_docs)]
pub trait KnownHead {
    type Head;
}

/// Head element type accessor.
pub type Head<T> = <T as KnownHead>::Head;

/// Head element accessor.
#[allow(missing_docs)]
pub trait GetHead: KnownHead {
    fn head(&self) -> &Self::Head;
}

/// Mutable head element accessor.
#[allow(missing_docs)]
pub trait GetHeadMut: KnownHead {
    fn head_mut(&mut self) -> &mut Self::Head;
}


// === Impls ===

impl<H, T> KnownHead for Cons<H, T> {
    type Head = H;
}

impl<H, T> GetHead for Cons<H, T> {
    #[inline(always)]
    fn head(&self) -> &Self::Head {
        &self.0
    }
}

impl<H, T> GetHeadMut for Cons<H, T> {
    #[inline(always)]
    fn head_mut(&mut self) -> &mut Self::Head {
        &mut self.0
    }
}



// ============
// === Tail ===
// ============

/// Tail element accessor.
#[allow(missing_docs)]
pub trait KnownTail {
    type Tail;
}

/// Tail element type accessor.
pub type Tail<T> = <T as KnownTail>::Tail;

/// Tail element accessor.
#[allow(missing_docs)]
pub trait GetTail: KnownTail {
    fn tail(&self) -> &Self::Tail;
}

/// Mutable tail element accessor.
#[allow(missing_docs)]
pub trait GetTailMut: KnownTail {
    fn tail_mut(&mut self) -> &mut Self::Tail;
}


// === Impls ===

impl<H, T> KnownTail for Cons<H, T> {
    type Tail = T;
}

impl<H, T> GetTail for Cons<H, T> {
    #[inline(always)]
    fn tail(&self) -> &Self::Tail {
        &self.1
    }
}

impl<H, T> GetTailMut for Cons<H, T> {
    #[inline(always)]
    fn tail_mut(&mut self) -> &mut Self::Tail {
        &mut self.1
    }
}


//
// // ============
// // === Last ===
// // ============
//
// /// Last element accessor.
// #[allow(missing_docs)]
// pub trait KnownLast {
//     type Last;
// }
//
// /// Last element type accessor.
// pub type Last<T> = <T as KnownLast>::Last;
//
// /// Last element accessor.
// #[allow(missing_docs)]
// pub trait GetLast: KnownLast {
//     fn last(&self) -> &Self::Last;
// }
//
// /// Mutable last element accessor.
// #[allow(missing_docs)]
// pub trait GetLastMut: KnownLast {
//     fn last_mut(&mut self) -> &mut Self::Last;
// }
//
//
//
// // === Impls ===
//
// impl<H> KnownLast for Cons<H, Nil> {
//     type Last = H;
// }
// impl<H, T: KnownLast> KnownLast for Cons<H, T> {
//     type Last = Last<T>;
// }
//
// impl<H> GetLast for Cons<H, Nil> {
//     #[inline(always)]
//     fn last(&self) -> &Self::Last {
//         &self.0
//     }
// }
//
// impl<H> GetLastMut for Cons<H, Nil> {
//     #[inline(always)]
//     fn last_mut(&mut self) -> &mut Self::Last {
//         &mut self.0
//     }
// }
//
// impl<H, T: GetLast> GetLast for Cons<H, T> {
//     #[inline(always)]
//     fn last(&self) -> &Self::Last {
//         self.tail().last()
//     }
// }
//
// impl<H, T: GetLastMut> GetLastMut for Cons<H, T> {
//     #[inline(always)]
//     fn last_mut(&mut self) -> &mut Self::Last {
//         self.tail_mut().last_mut()
//     }
// }



// ============
// === Init ===
// ============

// /// Init elements accessor (all but last).
// #[allow(missing_docs)]
// pub trait KnownInit {
//     type Init;
// }
//
// /// Init elements type accessor.
// pub type Init<T> = <T as KnownInit>::Init;
//
// /// Init element clone.
// #[allow(missing_docs)]
// pub trait GetInitClone: KnownInit {
//     fn init_clone(&self) -> Self::Init;
// }
//
//
// // === Impls ===
//
// impl<H> KnownInit for Cons<H, Nil> {
//     type Init = Nil;
// }
// impl<H, T: KnownInit> KnownInit for Cons<H, T> {
//     type Init = Cons<H, Init<T>>;
// }
//
// impl<H> GetInitClone for Cons<H, Nil> {
//     #[inline(always)]
//     fn init_clone(&self) -> Self::Init {
//         Nil
//     }
// }
//
// impl<H: Clone, T: GetInitClone> GetInitClone for Cons<H, T> {
//     #[inline(always)]
//     fn init_clone(&self) -> Self::Init {
//         Cons(self.head().clone(), self.tail().init_clone())
//     }
// }


//
// // ===============
// // === PopBack ===
// // ===============
//
// /// Remove the last element of the list and return it and the new list.
// #[allow(missing_docs)]
// pub trait PopBack: KnownLast + KnownInit {
//     fn pop_back(self) -> (Self::Last, Self::Init);
// }
//
// impl<H> PopBack for Cons<H, Nil> {
//     fn pop_back(self) -> (Self::Last, Self::Init) {
//         (self.0, Nil)
//     }
// }
//
// impl<H, T> PopBack for Cons<H, T>
// where T: PopBack
// {
//     #[inline(always)]
//     fn pop_back(self) -> (Self::Last, Self::Init) {
//         let (last, tail) = self.1.pop_back();
//         (last, Cons(self.0, tail))
//     }
// }

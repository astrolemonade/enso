//! Definition of [`Visitor`] deriving. It implements the visitor pattern for [`Ast`].

// === Non-Standard Linter Configuration ===
#![allow(clippy::option_map_unit_fn)]
#![allow(clippy::precedence)]
#![allow(dead_code)]
#![deny(unconditional_recursion)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(unused_qualifications)]



extern crate proc_macro;

use enso_macro_utils::field_names;
use enso_macro_utils::identifier_sequence;
use enso_macro_utils::index_sequence;
use proc_macro2::TokenStream;
use quote::quote;
use syn::Data;
use syn::DataEnum;
use syn::DataStruct;
use syn::DeriveInput;
use syn::Fields;
use syn::Variant;



/// ======================
/// === Derive Visitor ===
/// ======================
use quote::ToTokens;

/// Implements [`ItemVisitable`].
/// This trait is defined in the [`crate::ast`] module. Macros in this module hardcode the names
/// of the traits and are not implemented in a generic way because the current Rust implementation
/// does not understand generic definition. See the [`crate::ast`] module to learn more about the
/// design and the Rust compiler issue.
#[proc_macro_derive(Visitor)]
pub fn derive_visitor(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let decl = syn::parse_macro_input!(input as DeriveInput);
    let ident = &decl.ident;
    let (impl_generics, ty_generics, _inherent_where_clause_opt) = &decl.generics.split_for_impl();
    let body_item = gen_body(quote!(ItemVisitable::visit_item), &decl.data, false);

    let impl_generics_vec: Vec<_> = impl_generics.to_token_stream().into_iter().collect();
    let impl_generics_len = impl_generics_vec.len();
    let mut impl_generics;
    if impl_generics_len > 0 {
        let v: Vec<_> = impl_generics_vec.into_iter().take(impl_generics_len - 1).skip(1).collect();
        impl_generics = quote!(#(#v)*);
        if !v.is_empty() {
            impl_generics = quote!(#impl_generics,);
        }
    } else {
        impl_generics = quote!('s,);
    }
    let impl_generics = quote!(<#impl_generics 'a>);

    let output = quote! {
        impl #impl_generics ItemVisitable #impl_generics for #ident #ty_generics {
            fn visit_item<T: ItemVisitor #impl_generics>(&'a self, visitor:&mut T) {
                #body_item
            }
        }
    };

    output.into()
}

fn gen_body(f: TokenStream, data: &Data, is_mut: bool) -> TokenStream {
    match data {
        Data::Struct(t) => body_for_struct(&f, t, is_mut),
        Data::Enum(t) => body_for_enum(&f, t),
        Data::Union(_) => panic!("Untagged union types not supported."),
    }
}

fn body_for_struct(f: &TokenStream, data: &DataStruct, is_mut: bool) -> TokenStream {
    match &data.fields {
        Fields::Unit => quote!({}),
        Fields::Unnamed(fields) => {
            let indices = index_sequence(fields.unnamed.len());
            if is_mut {
                quote!(#( #f(&mut self.#indices, visitor); )*)
            } else {
                quote!(#( #f(&self.#indices, visitor); )*)
            }
        }
        Fields::Named(fields) => {
            let names = field_names(fields);
            if is_mut {
                quote!(#( #f(&mut self.#names, visitor); )*)
            } else {
                quote!(#( #f(&self.#names, visitor); )*)
            }
        }
    }
}

/// Prepares a match arm for a single variant that `clone_ref`s such value.
fn arm_for_variant(f: &TokenStream, variant: &Variant) -> TokenStream {
    let variant_ident = &variant.ident;
    match &variant.fields {
        Fields::Unit => {
            quote!(Self::#variant_ident => {})
        }
        Fields::Named(fields) => {
            let names = field_names(fields);
            quote!(Self::#variant_ident { #(#names),* } => {
                #( #f(#names, visitor); )*
            })
        }
        Fields::Unnamed(fields) => {
            let names = identifier_sequence(fields.unnamed.len());
            quote!(Self::#variant_ident(#(#names),*) => {
                #( #f(#names, visitor); )*
            })
        }
    }
}

fn body_for_enum(f: &TokenStream, data: &DataEnum) -> TokenStream {
    let make_arm = |variant| arm_for_variant(f, variant);
    let arms = data.variants.iter().map(make_arm);
    let body = quote!(match self { #(#arms)* });
    body
}

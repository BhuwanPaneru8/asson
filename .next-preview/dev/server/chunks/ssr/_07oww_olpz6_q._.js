module.exports = [
"[project]/.next-internal/server/app/(shop)/shop/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/actions/cart.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "4037d2b62158933915898e91feb70b5fef5d671d58",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addToCart"],
    "407fed4b3d00db838c6613a064acb3e78692e41b4c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeCartItem"],
    "40df7d1015bdc2a096351b55a3c57724f2af48019e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toggleWishlist"],
    "606099f10a92cc912da9068ca187ca7005500d9504",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateCartItem"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f28$shop$292f$shop$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/(shop)/shop/page/actions.js { ACTIONS_MODULE0 => "[project]/src/actions/cart.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/(shop)/shop/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/actions/cart.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)");
;
;
;
;
}),
"[project]/src/actions/cart.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4037d2b62158933915898e91feb70b5fef5d671d58":{"name":"addToCart"},"407fed4b3d00db838c6613a064acb3e78692e41b4c":{"name":"removeCartItem"},"606099f10a92cc912da9068ca187ca7005500d9504":{"name":"updateCartItem"},"60e9ccdf55be3d3edbc819a52bf4488b3c15ad14a1":{"name":"swapCartVariant"}},"src/actions/cart.ts",""] */ __turbopack_context__.s([
    "addToCart",
    ()=>addToCart,
    "removeCartItem",
    ()=>removeCartItem,
    "swapCartVariant",
    ()=>swapCartVariant,
    "updateCartItem",
    ()=>updateCartItem
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .number>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
const addSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    variantId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().min(1),
    quantity: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__["z"].number().int().min(1).max(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].maxQtyPerItem)
});
async function addToCart(input) {
    const parsed = addSchema.safeParse({
        quantity: 1,
        ...input
    });
    if (!parsed.success) return {
        ok: false,
        error: "Invalid item."
    };
    const { variantId, quantity } = parsed.data;
    const variant = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findUnique({
        where: {
            id: variantId
        },
        select: {
            stock: true,
            product: {
                select: {
                    status: true
                }
            }
        }
    });
    if (!variant || variant.product.status !== "ACTIVE") return {
        ok: false,
        error: "This item is no longer available."
    };
    if (variant.stock <= 0) return {
        ok: false,
        error: "Sorry, this size just sold out."
    };
    const cartId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureCartId"])();
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.findUnique({
        where: {
            cartId_variantId: {
                cartId,
                variantId
            }
        },
        select: {
            quantity: true
        }
    });
    const desired = (existing?.quantity ?? 0) + quantity;
    const capped = Math.min(desired, variant.stock, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].maxQtyPerItem);
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.upsert({
        where: {
            cartId_variantId: {
                cartId,
                variantId
            }
        },
        update: {
            quantity: capped
        },
        create: {
            cartId,
            variantId,
            quantity: capped
        }
    });
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.update({
        where: {
            id: cartId
        },
        data: {
            updatedAt: new Date()
        }
    });
    if (capped < desired) return {
        ok: true,
        message: `Only ${capped} available — we've added the maximum.`
    };
    return {
        ok: true
    };
}
async function updateCartItem(itemId, quantity) {
    const cart = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCart"])();
    const line = cart.lines.find((l)=>l.id === itemId);
    if (!line) return {
        ok: false,
        error: "Item not found in your bag."
    };
    if (quantity <= 0) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.delete({
            where: {
                id: itemId
            }
        });
    } else {
        const q = Math.min(Math.floor(quantity), line.stock, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].maxQtyPerItem);
        if (q <= 0) return {
            ok: false,
            error: "This size is out of stock."
        };
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.update({
            where: {
                id: itemId
            },
            data: {
                quantity: q
            }
        });
        if (q < quantity) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
            return {
                ok: true,
                message: `Only ${q} in stock.`
            };
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
async function removeCartItem(itemId) {
    return updateCartItem(itemId, 0);
}
async function swapCartVariant(itemId, newVariantId) {
    const cart = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCart"])();
    const line = cart.lines.find((l)=>l.id === itemId);
    if (!line || !cart.id) return {
        ok: false,
        error: "Item not found."
    };
    const v = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findUnique({
        where: {
            id: newVariantId
        },
        select: {
            stock: true,
            productId: true
        }
    });
    if (!v || v.productId !== line.productId) return {
        ok: false,
        error: "Invalid option."
    };
    if (v.stock <= 0) return {
        ok: false,
        error: "That size is sold out."
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.delete({
            where: {
                id: itemId
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cartItem.upsert({
            where: {
                cartId_variantId: {
                    cartId: cart.id,
                    variantId: newVariantId
                }
            },
            update: {
                quantity: {
                    increment: 0
                }
            },
            create: {
                cartId: cart.id,
                variantId: newVariantId,
                quantity: Math.min(line.quantity, v.stock)
            }
        })
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    addToCart,
    updateCartItem,
    removeCartItem,
    swapCartVariant
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(addToCart, "4037d2b62158933915898e91feb70b5fef5d671d58", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateCartItem, "606099f10a92cc912da9068ca187ca7005500d9504", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeCartItem, "407fed4b3d00db838c6613a064acb3e78692e41b4c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(swapCartVariant, "60e9ccdf55be3d3edbc819a52bf4488b3c15ad14a1", null);
}),
"[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"40df7d1015bdc2a096351b55a3c57724f2af48019e":{"name":"toggleWishlist"}},"src/actions/wishlist.ts",""] */ __turbopack_context__.s([
    "toggleWishlist",
    ()=>toggleWishlist
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
async function toggleWishlist(productId) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    if (!user) return {
        ok: false,
        needsLogin: true
    };
    const key = {
        userId_productId: {
            userId: user.id,
            productId
        }
    };
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].wishlistItem.findUnique({
        where: key
    });
    if (existing) await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].wishlistItem.delete({
        where: key
    });
    else await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].wishlistItem.create({
        data: {
            userId: user.id,
            productId
        }
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true,
        saved: !existing
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    toggleWishlist
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(toggleWishlist, "40df7d1015bdc2a096351b55a3c57724f2af48019e", null);
}),
];

//# sourceMappingURL=_07oww_olpz6_q._.js.map
module.exports = [
"[project]/.next-internal/server/app/(shop)/p/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/actions/cart.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/actions/recent.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/actions/account.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "403042573b025901765aa705a7f021bc7e8a53ec59",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$recent$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRecentlyViewed"],
    "4037d2b62158933915898e91feb70b5fef5d671d58",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addToCart"],
    "407fed4b3d00db838c6613a064acb3e78692e41b4c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeCartItem"],
    "4085e99f147b616594a1334108057515029d0b1815",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["subscribeStockAlert"],
    "40a614e9b2c5fd523d4d856860b79fc2a35297f03f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$account$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["submitReview"],
    "40df7d1015bdc2a096351b55a3c57724f2af48019e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toggleWishlist"],
    "606099f10a92cc912da9068ca187ca7005500d9504",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateCartItem"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f28$shop$292f$p$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$recent$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$account$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE4__$3d3e$__$225b$project$5d2f$src$2f$actions$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/(shop)/p/[slug]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/actions/cart.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/actions/recent.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/actions/account.ts [app-rsc] (ecmascript)", ACTIONS_MODULE4 => "[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$recent$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/recent.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$account$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/account.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/(shop)/p/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/actions/cart.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/actions/recent.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/actions/account.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$wishlist$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/wishlist.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$recent$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/recent.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$account$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/account.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$actions$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
}),
"[project]/src/actions/account.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4052b8d5a81b8bab6264140cc2f054a799bf18d6fa":{"name":"updateProfile"},"40a614e9b2c5fd523d4d856860b79fc2a35297f03f":{"name":"submitReview"},"40da1b1d50029429d0becac5618f306686c4a997b0":{"name":"setDefaultAddress"},"40f13bfe363a2847190ddb69bc57ace702c907e982":{"name":"deleteAddress"},"606657b79f40ba924976a702098221df5526517d80":{"name":"requestReturn"},"608cb869568be7bee8dad8483cefa8648e2bf771d1":{"name":"cancelOrder"},"60ae5e4b30bf4eb5703f4a7fc99dcdffd5e3e36ccb":{"name":"saveAddress"}},"src/actions/account.ts",""] */ __turbopack_context__.s([
    "cancelOrder",
    ()=>cancelOrder,
    "deleteAddress",
    ()=>deleteAddress,
    "requestReturn",
    ()=>requestReturn,
    "saveAddress",
    ()=>saveAddress,
    "setDefaultAddress",
    ()=>setDefaultAddress,
    "submitReview",
    ()=>submitReview,
    "updateProfile",
    ()=>updateProfile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$boolean$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .boolean>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$literal$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .literal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .number>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .enum>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/validators.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$orders$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/orders.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/order-status.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$notifications$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/notifications.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
async function saveAddress(input, id) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireUser"])();
    const parsed = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addressFields"].extend({
        isDefault: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$boolean$3e$__["z"].boolean().optional()
    }).transform(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withProvince"]).safeParse(input);
    if (!parsed.success) return {
        ok: false,
        fieldErrors: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fieldErrors"])(parsed.error)
    };
    const { isDefault, ...a } = parsed.data;
    const count = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.count({
        where: {
            userId: user.id
        }
    });
    const makeDefault = isDefault || count === 0;
    const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        if (makeDefault) await tx.address.updateMany({
            where: {
                userId: user.id
            },
            data: {
                isDefault: false
            }
        });
        if (id) {
            const own = await tx.address.findFirst({
                where: {
                    id,
                    userId: user.id
                }
            });
            if (!own) throw new Error("not found");
            return tx.address.update({
                where: {
                    id
                },
                data: {
                    ...a,
                    line2: a.line2 || null,
                    postalCode: a.postalCode || null,
                    ...makeDefault ? {
                        isDefault: true
                    } : {}
                }
            });
        }
        return tx.address.create({
            data: {
                ...a,
                line2: a.line2 || null,
                postalCode: a.postalCode || null,
                userId: user.id,
                isDefault: makeDefault
            }
        });
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true,
        id: saved.id
    };
}
async function deleteAddress(id) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireUser"])();
    const a = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.findFirst({
        where: {
            id,
            userId: user.id
        }
    });
    if (!a) return {
        ok: false,
        error: "Address not found."
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.delete({
        where: {
            id
        }
    });
    if (a.isDefault) {
        const next = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.findFirst({
            where: {
                userId: user.id
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        if (next) await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.update({
            where: {
                id: next.id
            },
            data: {
                isDefault: true
            }
        });
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
async function setDefaultAddress(id) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireUser"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.updateMany({
            where: {
                userId: user.id
            },
            data: {
                isDefault: false
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].address.updateMany({
            where: {
                id,
                userId: user.id
            },
            data: {
                isDefault: true
            }
        })
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
const profileSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(2).max(80),
    phone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["phoneSchema"].or(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$literal$3e$__["z"].literal(""))
});
async function updateProfile(input) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireUser"])();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return {
        ok: false,
        fieldErrors: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fieldErrors"])(parsed.error)
    };
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].user.update({
        where: {
            id: user.id
        },
        data: {
            name: parsed.data.name,
            phone: parsed.data.phone || null
        }
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
async function ownOrder(orderId) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    const order = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].order.findUnique({
        where: {
            id: orderId
        },
        select: {
            id: true,
            userId: true,
            email: true,
            status: true,
            updatedAt: true,
            events: {
                where: {
                    status: "DELIVERED"
                },
                select: {
                    createdAt: true
                }
            }
        }
    });
    if (!order) return null;
    // signed-in owners, or guests holding the unguessable order link
    if (order.userId && order.userId !== user?.id) return null;
    return {
        order,
        actor: user?.email ?? order.email
    };
}
async function cancelOrder(orderId, reason) {
    const o = await ownOrder(orderId);
    if (!o) return {
        ok: false,
        error: "Order not found."
    };
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CUSTOMER_CANCELLABLE"].includes(o.order.status)) return {
        ok: false,
        error: "This order has already been packed and can't be cancelled. You can return it after delivery."
    };
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$orders$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["transitionOrder"])({
            orderId,
            to: "CANCELLED",
            actor: o.actor,
            message: `Cancelled by customer${reason ? `: ${reason.slice(0, 200)}` : ""}`
        });
    } catch (e) {
        return {
            ok: false,
            error: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$orders$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TransitionError"] ? e.message : "Couldn't cancel. Please contact support."
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidateTag"])("products", {
        expire: 60
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["after"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$notifications$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["dispatchNotifications"])().catch(()=>{}));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
async function requestReturn(orderId, reason) {
    const o = await ownOrder(orderId);
    if (!o) return {
        ok: false,
        error: "Order not found."
    };
    if (o.order.status !== "DELIVERED") return {
        ok: false,
        error: "Only delivered orders can be returned."
    };
    const deliveredAt = o.order.events[0]?.createdAt ?? o.order.updatedAt;
    if (Date.now() - deliveredAt.getTime() > __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].returnWindowDays * 86400000) return {
        ok: false,
        error: `The ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].returnWindowDays}-day return window for this order has closed.`
    };
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$orders$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["transitionOrder"])({
            orderId,
            to: "RETURN_REQUESTED",
            actor: o.actor,
            message: `Return requested: ${reason.slice(0, 200) || "No reason given"}`
        });
    } catch (e) {
        return {
            ok: false,
            error: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$orders$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["TransitionError"] ? e.message : "Couldn't request a return."
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
const reviewSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    productId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string(),
    rating: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__["z"].number().int().min(1).max(5),
    title: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(2, "Add a short title").max(80),
    body: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),
    fit: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum([
        "Runs small",
        "True to size",
        "Runs large"
    ]).optional()
});
async function submitReview(input) {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    if (!user) return {
        ok: false,
        error: "Please sign in to write a review."
    };
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return {
        ok: false,
        fieldErrors: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$validators$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fieldErrors"])(parsed.error)
    };
    const d = parsed.data;
    const purchased = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].orderItem.findFirst({
        where: {
            productId: d.productId,
            order: {
                userId: user.id,
                status: "DELIVERED"
            }
        },
        select: {
            id: true
        }
    });
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        await tx.review.upsert({
            where: {
                productId_userId: {
                    productId: d.productId,
                    userId: user.id
                }
            },
            update: {
                rating: d.rating,
                title: d.title,
                body: d.body,
                fit: d.fit,
                verified: !!purchased
            },
            create: {
                ...d,
                userId: user.id,
                verified: !!purchased
            }
        });
        const agg = await tx.review.aggregate({
            where: {
                productId: d.productId,
                status: "PUBLISHED"
            },
            _avg: {
                rating: true
            },
            _count: {
                _all: true
            }
        });
        await tx.product.update({
            where: {
                id: d.productId
            },
            data: {
                ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
                ratingCount: agg._count._all
            }
        });
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidateTag"])("products", {
        expire: 0
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refresh"])();
    return {
        ok: true
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    updateProfile,
    cancelOrder,
    requestReturn,
    submitReview
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveAddress, "60ae5e4b30bf4eb5703f4a7fc99dcdffd5e3e36ccb", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteAddress, "40f13bfe363a2847190ddb69bc57ace702c907e982", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(setDefaultAddress, "40da1b1d50029429d0becac5618f306686c4a997b0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateProfile, "4052b8d5a81b8bab6264140cc2f054a799bf18d6fa", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(cancelOrder, "608cb869568be7bee8dad8483cefa8648e2bf771d1", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(requestReturn, "606657b79f40ba924976a702098221df5526517d80", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(submitReview, "40a614e9b2c5fd523d4d856860b79fc2a35297f03f", null);
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
"[project]/src/actions/recent.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"403042573b025901765aa705a7f021bc7e8a53ec59":{"name":"getRecentlyViewed"}},"src/actions/recent.ts",""] */ __turbopack_context__.s([
    "getRecentlyViewed",
    ()=>getRecentlyViewed
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .array>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/catalog.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
const ids = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().regex(/^[a-z0-9]{10,40}$/)).max(12);
async function getRecentlyViewed(input) {
    const parsed = ids.safeParse(input);
    return parsed.success ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCardsByIds"])(parsed.data) : [];
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getRecentlyViewed
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getRecentlyViewed, "403042573b025901765aa705a7f021bc7e8a53ec59", null);
}),
"[project]/src/actions/stock-alerts.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4085e99f147b616594a1334108057515029d0b1815":{"name":"subscribeStockAlert"}},"src/actions/stock-alerts.ts",""] */ __turbopack_context__.s([
    "subscribeStockAlert",
    ()=>subscribeStockAlert
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rate-limit.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$client$2d$ip$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/client-ip.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const schema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    variantId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().min(1).max(40),
    phone: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().regex(/^9[678]\d{8}$/, "Enter a 10-digit Nepali mobile number")
});
async function subscribeStockAlert(input) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Check the number."
    };
    const { variantId, phone } = parsed.data;
    const ip = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$client$2d$ip$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["clientIp"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["headers"])());
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rate$2d$limit$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rateLimit"])(`alert:${ip}`, 20, 60 * 60_000)) return {
        ok: false,
        error: "Too many requests. Please try again later."
    };
    const v = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findUnique({
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
    if (!v || v.product.status !== "ACTIVE") return {
        ok: false,
        error: "This item isn't available."
    };
    if (v.stock > 0) return {
        ok: false,
        error: "Good news — it's in stock right now. Add it to your bag."
    };
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].stockAlert.upsert({
        where: {
            variantId_phone: {
                variantId,
                phone
            }
        },
        create: {
            variantId,
            phone,
            userId: user?.id
        },
        update: {
            notifiedAt: null,
            ...user ? {
                userId: user.id
            } : {}
        }
    });
    return {
        ok: true,
        message: "Done — we'll text you as soon as it's back."
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    subscribeStockAlert
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(subscribeStockAlert, "4085e99f147b616594a1334108057515029d0b1815", null);
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
"[project]/src/lib/client-ip.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * The visitor's IP for rate limiting. In production every request arrives through Cloudflare
 * (tunnel, no open ports), which sets CF-Connecting-IP and can't be spoofed by the client.
 * X-Forwarded-For is only a fallback for local/dev: its first entry is client-controlled.
 */ __turbopack_context__.s([
    "clientIp",
    ()=>clientIp
]);
function clientIp(h) {
    return h.get("cf-connecting-ip")?.trim() || h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
}),
"[project]/src/lib/loyalty-shared.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "maxRedeemable",
    ()=>maxRedeemable,
    "nextTier",
    ()=>nextTier,
    "pointsToEarn",
    ()=>pointsToEarn,
    "pointsValue",
    ()=>pointsValue,
    "tierFor",
    ()=>tierFor
]);
// Client-safe loyalty maths (pure). Server bookkeeping lives in lib/loyalty.ts.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
;
const L = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].loyalty;
function tierFor(spend12m) {
    return [
        ...L.tiers
    ].reverse().find((t)=>spend12m >= t.minSpend) ?? L.tiers[0];
}
function nextTier(spend12m) {
    const next = L.tiers.find((t)=>t.minSpend > spend12m);
    return next ? {
        tier: next,
        remaining: next.minSpend - spend12m
    } : null;
}
function pointsToEarn(paidForGoods, tier) {
    return Math.max(0, Math.floor(paidForGoods / L.earnPer * tier.multiplier));
}
const pointsValue = (points)=>points * L.pointValue;
function maxRedeemable(balance, bagAfterCoupon) {
    if (balance < L.minRedeem || bagAfterCoupon <= 0) return 0;
    const capByBag = Math.floor(bagAfterCoupon * L.maxRedeemPercent / 100 / L.pointValue);
    return Math.max(0, Math.min(balance, capByBag));
}
}),
"[project]/src/lib/loyalty.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "earnForOrder",
    ()=>earnForOrder,
    "refundRedeemed",
    ()=>refundRedeemed,
    "reverseForReturn",
    ()=>reverseForReturn,
    "spendLast12Months",
    ()=>spendLast12Months
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2d$shared$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/loyalty-shared.ts [app-rsc] (ecmascript)");
;
;
async function spendLast12Months(tx, userId, excludeOrderId) {
    const since = new Date(Date.now() - 365 * 86_400_000);
    const agg = await tx.order.aggregate({
        where: {
            userId,
            status: "DELIVERED",
            createdAt: {
                gte: since
            },
            ...excludeOrderId ? {
                id: {
                    not: excludeOrderId
                }
            } : {}
        },
        _sum: {
            total: true,
            shippingFee: true
        }
    });
    return (agg._sum.total ?? 0) - (agg._sum.shippingFee ?? 0);
}
async function earnForOrder(tx, orderId) {
    const o = await tx.order.findUnique({
        where: {
            id: orderId
        },
        select: {
            id: true,
            userId: true,
            total: true,
            shippingFee: true,
            pointsEarned: true
        }
    });
    if (!o?.userId || o.pointsEarned > 0) return 0;
    const tier = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2d$shared$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["tierFor"])(await spendLast12Months(tx, o.userId, o.id));
    const pts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2d$shared$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pointsToEarn"])(o.total - o.shippingFee, tier);
    if (!pts) return 0;
    const claimed = await tx.order.updateMany({
        where: {
            id: o.id,
            pointsEarned: 0
        },
        data: {
            pointsEarned: pts
        }
    });
    if (!claimed.count) return 0;
    await tx.user.update({
        where: {
            id: o.userId
        },
        data: {
            points: {
                increment: pts
            }
        }
    });
    await tx.pointsEntry.create({
        data: {
            userId: o.userId,
            delta: pts,
            reason: "EARN",
            orderId: o.id,
            note: `${tier.name} tier`
        }
    });
    return pts;
}
async function reverseForReturn(tx, orderId, refunded) {
    const o = await tx.order.findUnique({
        where: {
            id: orderId
        },
        select: {
            userId: true,
            total: true,
            shippingFee: true,
            pointsEarned: true
        }
    });
    if (!o?.userId || !o.pointsEarned) return 0;
    const goods = Math.max(1, o.total - o.shippingFee);
    const taken = await tx.pointsEntry.aggregate({
        where: {
            orderId,
            reason: "RETURN_REVERSE"
        },
        _sum: {
            delta: true
        }
    });
    const left = o.pointsEarned + (taken._sum.delta ?? 0); // reversals are negative
    const pts = Math.min(left, Math.ceil(o.pointsEarned * refunded / goods));
    if (pts <= 0) return 0;
    // balance may go negative if points were already spent — that blocks redemption until it recovers
    await tx.user.update({
        where: {
            id: o.userId
        },
        data: {
            points: {
                decrement: pts
            }
        }
    });
    await tx.pointsEntry.create({
        data: {
            userId: o.userId,
            delta: -pts,
            reason: "RETURN_REVERSE",
            orderId
        }
    });
    return pts;
}
async function refundRedeemed(tx, orderId) {
    const o = await tx.order.findUnique({
        where: {
            id: orderId
        },
        select: {
            userId: true,
            pointsRedeemed: true
        }
    });
    if (!o?.userId || !o.pointsRedeemed) return 0;
    const already = await tx.pointsEntry.count({
        where: {
            orderId,
            reason: "REDEEM_REFUND"
        }
    });
    if (already) return 0;
    await tx.user.update({
        where: {
            id: o.userId
        },
        data: {
            points: {
                increment: o.pointsRedeemed
            }
        }
    });
    await tx.pointsEntry.create({
        data: {
            userId: o.userId,
            delta: o.pointsRedeemed,
            reason: "REDEEM_REFUND",
            orderId
        }
    });
    return o.pointsRedeemed;
}
}),
"[project]/src/lib/notifications.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NOTICE_FOR_STATUS",
    ()=>NOTICE_FOR_STATUS,
    "dispatchNotifications",
    ()=>dispatchNotifications,
    "queueOrderNotice",
    ()=>queueOrderNotice,
    "renderSms",
    ()=>renderSms,
    "smsProvider",
    ()=>smsProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
;
const siteUrl = ()=>(("TURBOPACK compile-time value", "http://localhost:3000") ?? "http://localhost:3000").replace(/\/$/, "");
function renderSms(notice, o, extra = {}) {
    const n = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOrderNumber"])(o.number);
    const name = (o.shippingAddress?.fullName ?? "").split(" ")[0];
    const hi = name ? `Hi ${name}, ` : "";
    const link = `${siteUrl()}/orders/${o.id}`;
    const cod = o.paymentMethod === "COD" ? ` Please keep ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPrice"])(o.total)} ready.` : "";
    switch(notice){
        case "placed":
            return `${hi}thanks for shopping with ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}! Order ${n} (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPrice"])(o.total)}) is placed. We'll call to confirm shortly. ${link}`;
        case "confirmed":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: order ${n} is confirmed and being packed. Track: ${link}`;
        case "shipped":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: order ${n} is on its way${o.carrier ? ` with ${o.carrier}` : ""}${o.trackingNumber ? ` (${o.trackingNumber})` : ""}.${cod} ${link}`;
        case "out_for_delivery":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: order ${n} is out for delivery today.${cod} Rider will call you.`;
        case "delivered":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: order ${n} delivered. Love it? Leave a review: ${link} Need a size swap? Returns within ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].returnWindowDays} days.`;
        case "cancelled":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: order ${n} has been cancelled. If you paid online, the refund is on its way. Questions? ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].supportPhone}`;
        case "return_requested":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: return for ${n} received. We'll arrange pickup and update you. ${link}`;
        case "returned":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: your return for ${n} is complete. ${link}`;
        case "refund":
            return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: refund of ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPrice"])(extra.amount ?? 0)} for ${n} has been issued. Thank you for shopping with us.`;
    }
}
const NOTICE_FOR_STATUS = {
    CONFIRMED: "confirmed",
    SHIPPED: "shipped",
    OUT_FOR_DELIVERY: "out_for_delivery",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
    RETURN_REQUESTED: "return_requested",
    RETURNED: "returned"
};
async function queueOrderNotice(tx, orderId, notice, extra = {}) {
    const o = await tx.order.findUnique({
        where: {
            id: orderId
        },
        select: {
            id: true,
            number: true,
            phone: true,
            total: true,
            paymentMethod: true,
            carrier: true,
            trackingNumber: true,
            shippingAddress: true,
            channel: true
        }
    });
    if (!o || o.channel === "STORE" && notice !== "refund") return;
    const valid = /^9[678]\d{8}$/.test(o.phone);
    await tx.notification.create({
        data: {
            orderId: o.id,
            channel: "SMS",
            template: notice,
            to: o.phone,
            body: renderSms(notice, o, extra),
            status: valid ? "QUEUED" : "SKIPPED",
            error: valid ? null : "No valid Nepali mobile number"
        }
    });
}
const providers = {
    log: {
        name: "log",
        async send (to, body) {
            console.info(`[sms:log] → ${to}: ${body}`);
            return {
                ok: true,
                ref: `log-${Date.now()}`
            };
        }
    }
};
function smsProvider() {
    const name = process.env.NOTIFY_SMS_PROVIDER ?? (("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "log");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
     // never fake-send in production
    return providers[name] ?? null;
}
const MAX_ATTEMPTS = 5;
async function dispatchNotifications(limit = 50) {
    const provider = smsProvider();
    if (!provider) return {
        sent: 0,
        failed: 0,
        waiting: await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].notification.count({
            where: {
                status: "QUEUED"
            }
        })
    };
    const now = Date.now();
    const due = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].notification.findMany({
        where: {
            channel: "SMS",
            OR: [
                {
                    status: "QUEUED"
                },
                {
                    status: "FAILED",
                    attempts: {
                        lt: MAX_ATTEMPTS
                    }
                }
            ]
        },
        orderBy: {
            createdAt: "asc"
        },
        take: limit
    });
    let sent = 0, failed = 0;
    for (const n of due){
        // exponential backoff for retries: 1, 2, 4, 8 minutes
        if (n.status === "FAILED" && now - n.createdAt.getTime() < 60_000 * 2 ** (n.attempts - 1)) continue;
        // claim it so two dispatchers never send the same SMS
        const claimed = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].notification.updateMany({
            where: {
                id: n.id,
                status: n.status,
                attempts: n.attempts
            },
            data: {
                attempts: {
                    increment: 1
                }
            }
        });
        if (!claimed.count) continue;
        const r = await provider.send(n.to, n.body).catch((e)=>({
                ok: false,
                error: String(e),
                retry: true
            }));
        if (r.ok) {
            sent++;
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].notification.update({
                where: {
                    id: n.id
                },
                data: {
                    status: "SENT",
                    sentAt: new Date(),
                    provider: provider.name,
                    providerRef: r.ref ?? null,
                    error: null
                }
            });
        } else {
            failed++;
            // permanent errors (bad number, blocked) stop retrying immediately
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].notification.update({
                where: {
                    id: n.id
                },
                data: {
                    status: "FAILED",
                    provider: provider.name,
                    error: r.error.slice(0, 300),
                    ...r.retry ? {} : {
                        attempts: MAX_ATTEMPTS
                    }
                }
            });
        }
    }
    return {
        sent,
        failed,
        waiting: 0
    };
}
}),
"[project]/src/lib/order-status.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CUSTOMER_CANCELLABLE",
    ()=>CUSTOMER_CANCELLABLE,
    "STATUS_LABEL",
    ()=>STATUS_LABEL,
    "TRANSITIONS",
    ()=>TRANSITIONS
]);
const STATUS_LABEL = {
    PENDING: "Order placed",
    CONFIRMED: "Confirmed",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    RETURN_REQUESTED: "Return requested",
    RETURNED: "Returned"
};
const TRANSITIONS = {
    PENDING: [
        "CONFIRMED",
        "CANCELLED"
    ],
    CONFIRMED: [
        "PACKED",
        "CANCELLED"
    ],
    PACKED: [
        "SHIPPED",
        "CANCELLED"
    ],
    SHIPPED: [
        "OUT_FOR_DELIVERY",
        "DELIVERED"
    ],
    OUT_FOR_DELIVERY: [
        "DELIVERED"
    ],
    DELIVERED: [
        "RETURN_REQUESTED"
    ],
    RETURN_REQUESTED: [
        "RETURNED",
        "DELIVERED"
    ],
    CANCELLED: [],
    RETURNED: []
};
const CUSTOMER_CANCELLABLE = [
    "PENDING",
    "CONFIRMED"
];
}),
"[project]/src/lib/orders.ts [app-rsc] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TransitionError",
    ()=>TransitionError,
    "transitionOrder",
    ()=>transitionOrder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/stock-alerts.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$notifications$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/notifications.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/loyalty.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/order-status.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
class TransitionError extends Error {
}
async function transitionOrder(opts) {
    const { orderId, to, actor, actorId } = opts;
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        const order = await tx.order.findUnique({
            where: {
                id: orderId
            },
            include: {
                items: {
                    include: {
                        returnItems: {
                            select: {
                                quantity: true
                            }
                        }
                    }
                }
            }
        });
        if (!order) throw new TransitionError("Order not found.");
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TRANSITIONS"][order.status].includes(to)) throw new TransitionError(`Can't move an order from ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["STATUS_LABEL"][order.status]} to ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["STATUS_LABEL"][to]}.`);
        const data = {
            status: to
        };
        if (to === "SHIPPED" && opts.shipping) {
            data.carrier = opts.shipping.carrier || order.carrier;
            data.trackingNumber = opts.shipping.trackingNumber || order.trackingNumber;
        }
        if (to === "DELIVERED" && order.paymentMethod === "COD") data.paymentStatus = "PAID";
        if ((to === "CANCELLED" || to === "RETURNED") && order.paymentStatus === "PAID") data.paymentStatus = "REFUNDED";
        // optimistic concurrency: only succeeds if nobody else moved the order meanwhile
        const res = await tx.order.updateMany({
            where: {
                id: orderId,
                status: order.status
            },
            data
        });
        if (res.count === 0) throw new TransitionError("This order was just updated by someone else. Refresh and try again.");
        if (to === "CANCELLED" || to === "RETURNED") {
            for (const it of order.items){
                // units already handled by a store return were restocked (or quarantined) there
                const qty = it.quantity - it.returnItems.reduce((s, r)=>s + r.quantity, 0);
                if (!it.variantId || qty <= 0) continue;
                await tx.variant.update({
                    where: {
                        id: it.variantId
                    },
                    data: {
                        stock: {
                            increment: qty
                        }
                    }
                });
                await tx.inventoryLog.create({
                    data: {
                        variantId: it.variantId,
                        delta: qty,
                        reason: to === "CANCELLED" ? "CANCEL_RESTOCK" : "RETURN_RESTOCK",
                        orderId,
                        actorId
                    }
                });
                await tx.product.update({
                    where: {
                        id: it.productId
                    },
                    data: {
                        soldCount: {
                            decrement: qty
                        }
                    }
                });
            }
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$stock$2d$alerts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["queueBackInStock"])(tx, order.items.flatMap((i)=>i.variantId ? [
                    i.variantId
                ] : []));
        }
        const shipNote = to === "SHIPPED" && (data.carrier || data.trackingNumber) ? ` via ${data.carrier ?? "courier"}${data.trackingNumber ? ` (${data.trackingNumber})` : ""}` : "";
        await tx.orderEvent.create({
            data: {
                orderId,
                status: to,
                actor,
                message: opts.message || `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$order$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["STATUS_LABEL"][to]}${shipNote}`
            }
        });
        // loyalty: earn on delivery, give back spent points on cancel, take back earned points on return
        if (to === "DELIVERED") await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["earnForOrder"])(tx, orderId);
        if (to === "CANCELLED") await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refundRedeemed"])(tx, orderId);
        if (to === "RETURNED") {
            const alreadyRefunded = await tx.returnItem.aggregate({
                where: {
                    orderItem: {
                        orderId
                    }
                },
                _sum: {
                    amount: true
                }
            });
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$loyalty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["reverseForReturn"])(tx, orderId, Math.max(0, order.total - order.shippingFee - (alreadyRefunded._sum.amount ?? 0)));
        }
        const notice = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$notifications$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NOTICE_FOR_STATUS"][to];
        if (notice) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$notifications$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["queueOrderNotice"])(tx, orderId, notice);
        return {
            from: order.status,
            to
        };
    });
}
}),
"[project]/src/lib/rate-limit.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "rateLimit",
    ()=>rateLimit
]);
/**
 * Fixed-window in-memory rate limiter.
 * Good for a single instance; when running multiple app instances, back this with Redis
 * (same interface) so limits are shared.
 */ const buckets = new Map();
function rateLimit(key, limit, windowMs) {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) {
        buckets.set(key, {
            count: 1,
            reset: now + windowMs
        });
        if (buckets.size > 50_000) {
            for (const [k, v] of buckets)if (v.reset < now) buckets.delete(k);
        }
        return true;
    }
    b.count++;
    return b.count <= limit;
}
}),
"[project]/src/lib/stock-alerts.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "queueBackInStock",
    ()=>queueBackInStock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
;
;
const siteUrl = ()=>(("TURBOPACK compile-time value", "http://localhost:3000") ?? "http://localhost:3000").replace(/\/$/, "");
async function queueBackInStock(tx, variantIds) {
    if (!variantIds.length) return 0;
    const alerts = await tx.stockAlert.findMany({
        where: {
            variantId: {
                in: [
                    ...new Set(variantIds)
                ]
            },
            notifiedAt: null,
            variant: {
                stock: {
                    gt: 0
                },
                product: {
                    status: "ACTIVE"
                }
            }
        },
        select: {
            id: true,
            phone: true,
            variant: {
                select: {
                    color: true,
                    size: true,
                    product: {
                        select: {
                            name: true,
                            slug: true
                        }
                    }
                }
            }
        },
        take: 2000
    });
    let queued = 0;
    for (const a of alerts){
        const claimed = await tx.stockAlert.updateMany({
            where: {
                id: a.id,
                notifiedAt: null
            },
            data: {
                notifiedAt: new Date()
            }
        });
        if (!claimed.count) continue;
        const p = a.variant.product;
        await tx.notification.create({
            data: {
                channel: "SMS",
                template: "back_in_stock",
                to: a.phone,
                body: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name}: good news! ${p.name} (${a.variant.color}, ${a.variant.size}) is back in stock. Get yours before it goes again: ${siteUrl()}/p/${p.slug}?color=${encodeURIComponent(a.variant.color)}`
            }
        });
        queued++;
    }
    return queued;
}
}),
"[project]/src/lib/validators.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addressFields",
    ()=>addressFields,
    "addressSchema",
    ()=>addressSchema,
    "fieldErrors",
    ()=>fieldErrors,
    "phoneSchema",
    ()=>phoneSchema,
    "postalCodeSchema",
    ()=>postalCodeSchema,
    "withProvince",
    ()=>withProvince
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$literal$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .literal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
;
;
const phoneSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().regex(/^9[678]\d{8}$/, "Enter a valid 10-digit mobile number (98XXXXXXXX)");
const postalCodeSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().regex(/^\d{5}$/, "Postal codes in Nepal have 5 digits");
const addressFields = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    fullName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(2, "Enter the recipient's name").max(80),
    phone: phoneSchema,
    line1: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(3, "Enter your tole / street and house no.").max(120),
    line2: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().max(120).optional().or(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$literal$3e$__["z"].literal("")),
    city: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(2, "Enter your city or municipality").max(60),
    district: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().refine((d)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DISTRICTS"].includes(d), "Select your district"),
    postalCode: postalCodeSchema.optional().or(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$literal$3e$__["z"].literal(""))
});
const withProvince = (a)=>({
        ...a,
        state: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["provinceOf"])(a.district)
    });
const addressSchema = addressFields.transform(withProvince);
function fieldErrors(err) {
    const out = {};
    for (const i of err.issues)out[i.path.join(".")] ??= i.message;
    return out;
}
}),
];

//# sourceMappingURL=_0ln_a84l1g-pr._.js.map
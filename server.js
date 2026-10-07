const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "lili123";

const SESSION_SECRET =
    process.env.SESSION_SECRET || "lili-local-secret-2026";


/* =========================
   SUPABASE
========================= */

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


let supabase = null;

if (
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY
) {
    supabase = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}


/* =========================
   EXPRESS
========================= */

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================
   SESSION
========================= */

app.use(
    session({
        secret: SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24
        }
    })
);


/* =========================
   ANA SAYFA
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});


/* =========================
   LILI CEVAP GÖNDERİYOR
========================= */

app.post(
    "/api/answer",
    async (req, res) => {

        const answer =
            req.body.answer;


        if (
            answer !== "forgiven" &&
            answer !== "upset"
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Geçersiz cevap."
                });
        }


        if (!supabase) {

            console.error(
                "Supabase environment variables eksik."
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Veritabanı bağlantısı hazır değil."
                });
        }


        try {

            const {
                data,
                error
            } = await supabase
                .from("lili_answer")
                .insert({
                    answer: answer
                })
                .select()
                .single();


            if (error) {
                throw error;
            }


            console.log(
                "Yeni cevap Supabase'e kaydedildi:",
                {
                    id: data.id,
                    answer: data.answer,
                    created_at: data.created_at
                }
            );


            return res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "Supabase kayıt hatası:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Cevap kaydedilemedi."
                });
        }
    }
);


/* =========================
   LOGIN SAYFASI
========================= */

app.get(
    "/login",
    (req, res) => {

        if (
            req.session &&
            req.session.isAdmin
        ) {
            return res.redirect(
                "/admin"
            );
        }


        res.sendFile(
            path.join(
                __dirname,
                "login.html"
            )
        );
    }
);


/* =========================
   ADMIN LOGIN
========================= */

app.post(
    "/api/admin/login",
    (req, res) => {

        const password =
            req.body.password;


        if (
            password ===
            ADMIN_PASSWORD
        ) {

            req.session.isAdmin =
                true;


            return res.json({
                success: true
            });
        }


        return res
            .status(401)
            .json({
                success: false,
                message:
                    "Şifre yanlış."
            });
    }
);


/* =========================
   ADMIN KONTROL
========================= */

function requireAdmin(
    req,
    res,
    next
) {

    if (
        req.session &&
        req.session.isAdmin
    ) {
        return next();
    }


    return res.redirect(
        "/login"
    );
}


/* =========================
   ADMIN PANELİ
========================= */

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);


/* =========================
   SON CEVABI OKU
========================= */

app.get(
    "/api/answer",
    async (req, res) => {

        if (
            !req.session ||
            !req.session.isAdmin
        ) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Yetkisiz erişim."
                });
        }


        if (!supabase) {

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Veritabanı bağlantısı hazır değil."
                });
        }


        try {

            const {
                data,
                error
            } = await supabase
                .from("lili_answer")
                .select(
                    "answer, created_at"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(1)
                .maybeSingle();


            if (error) {
                throw error;
            }


            if (!data) {

                return res.json({
                    answer: null,
                    date: null
                });
            }


            return res.json({
                answer: data.answer,
                date: data.created_at
            });


        } catch (error) {

            console.error(
                "Supabase okuma hatası:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Cevap okunamadı."
                });
        }
    }
);


/* =========================
   ADMIN ÇIKIŞ
========================= */

app.post(
    "/api/admin/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    return res
                        .status(500)
                        .json({
                            success: false
                        });
                }


                res.clearCookie(
                    "connect.sid"
                );


                return res.json({
                    success: true
                });
            }
        );
    }
);


/* =========================
   SUNUCU
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Lili sitesi çalışıyor: http://localhost:${PORT}`
        );

        console.log(
            `Admin girişi: http://localhost:${PORT}/login`
        );

        if (supabase) {
            console.log(
                "Supabase bağlantısı hazır."
            );
        } else {
            console.log(
                "Supabase bilgileri bulunamadı."
            );
        }
    }
);
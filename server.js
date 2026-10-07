const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();

const PORT = process.env.PORT || 3000;

/*
    ŞİMDİLİK LOCAL TEST ŞİFRESİ

    Daha sonra Render'a geçtiğimizde bunu
    Environment Variable olarak gizleyeceğiz.
*/
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "lili123";

const SESSION_SECRET =
    process.env.SESSION_SECRET || "lili-local-secret-2026";


app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


/* =========================
   SESSION / OTURUM
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
   CEVAP DOSYASI
========================= */

const DATA_FILE =
    path.join(
        __dirname,
        "answer.json"
    );


function getAnswer() {

    try {

        if (!fs.existsSync(DATA_FILE)) {

            return {
                answer: null,
                date: null
            };
        }


        const file =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );


        return JSON.parse(file);

    } catch (error) {

        console.error(
            "Cevap okunamadı:",
            error
        );


        return {
            answer: null,
            date: null
        };
    }
}


function saveAnswer(answer) {

    const data = {

        answer: answer,

        date:
            new Date().toISOString()
    };


    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );


    return data;
}


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
    (req, res) => {

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
                    message:
                        "Geçersiz cevap."
                });
        }


        try {

            const saved =
                saveAnswer(answer);


            console.log(
                "Yeni cevap:",
                saved
            );


            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Cevap kaydedilemedi:",
                error
            );


            res
                .status(500)
                .json({
                    success: false
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

        /*
            Zaten giriş yaptıysan
            tekrar login göstermesin.
        */

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
   ADMIN LOGIN API
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
   ADMIN CEVABI OKUYOR
========================= */

app.get(
    "/api/answer",
    (req, res) => {

        /*
            Cevabı yalnızca giriş
            yapan admin okuyabilir.
        */

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


        res.json(
            getAnswer()
        );
    }
);


/* =========================
   ÇIKIŞ
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


                res.json({
                    success: true
                });
            }
        );
    }
);


/* =========================
   STATİK DOSYALAR
========================= */

/*
    HTML dosyalarını burada
    doğrudan public yapmıyoruz.

    Gerekli diğer dosyalar için
    static kullanıyoruz.
*/

app.use(
    express.static(
        __dirname,
        {
            index: false
        }
    )
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
    }
);
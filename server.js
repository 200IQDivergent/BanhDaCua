require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

const DISCORD_WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;

const DISCORD_WEBHOOK_USERNAME =
    process.env.DISCORD_WEBHOOK_USERNAME ||
    "Bánh Đa Cua Cô Huệ";

const DISCORD_WEBHOOK_AVATAR_URL =
    process.env.DISCORD_WEBHOOK_AVATAR_URL ||
    "";
if (!DISCORD_WEBHOOK_URL) {
    console.error(
        "❌ Thiếu DISCORD_WEBHOOK_URL trong file .env"
    );

    process.exit(1);
}

const TOPPINGS = [
    "ĐẬU",
    "THỊT TRẦN",
    "CHẢ LÁ LỐT",
    "CHẢ GIÒ",
    "THỊT RÁN",
    "CHẢ VIÊN",
    "TRỨNG CÚT",
    "CHẢ CÁ",
    "CÁ RÁN",
    "HÀNH LÁ",
    "HÀNH PHI",
    "MÌ CHÍNH"
];

// Middleware
app.use(bodyParser.json());
app.use(express.json());

// Static
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/checkVoucher",(req,res)=>{

    try{

        const code =
        req.body.code
        .trim()
        .toUpperCase();

        const voucherData =
        JSON.parse(

            fs.readFileSync(

                "./voucher.json",

                "utf8"

            )

        );

        const found =
        voucherData.vouchers.find(

            v=>

            v.code.toUpperCase()

            ===

            code

        );

        if(found){

            res.json({

                valid:true,

                gift:found.gift

            });

        }
        else{

            res.json({

                valid:false

            });

        }

    }

    catch(error){

        console.error(error);

        res.json({

            valid:false

        });

    }

});

// 🔥 FORMAT TEXT CHO DISCORD (đẹp hơn)

function getVoucherGift(code){

    try{

        if(!code || code.trim()===""){

            return "";

        }

        const voucherData = JSON.parse(

            fs.readFileSync(

                "./voucher.json",

                "utf8"

            )

        );

        const found =

        voucherData.vouchers.find(

            v=>

            v.code.toUpperCase()

            ===

            code.toUpperCase()

        );

        if(found){

            return found.gift;

        }

        return "";

    }

    catch(error){

        console.error(error);

        return "";

    }

}

//Note cho dòng cuối cùng của đơn ( Dưới dòng tổng tiền )
const FOOTER_NOTE = 
  `** Anh / Chị nhớ mang tờ này ra quầy
  đưa cho nhân viên khi thanh toán **
  
  Service made by NAM ( Chilling Coder)`;

function centerText(text, width = 40) {

    const padding = Math.max(
        0,
        Math.floor((width - text.length) / 2)
    );

    return " ".repeat(padding) + text;
}

function clampQty(value) {
    const n = Number.parseInt(value, 10);

    if (!Number.isFinite(n) || n <= 0) {
        return 0;
    }

    return Math.min(n, 100);
}


function normalizeToppingList(values) {

    if (!Array.isArray(values)) {
        return [];
    }

    const selected = new Set(
        values
            .map(x => String(x).trim().toUpperCase())
            .filter(Boolean)
    );

    return TOPPINGS.filter(x => selected.has(x));
}


function normalizeBowlCustomization(raw) {

    if (!raw || typeof raw !== "object") {
        return null;
    }

    const source =
        raw.tuyChinhKhiGui ||
        raw.tuyChinh ||
        raw;

    let only =
        normalizeToppingList(source.only);

    let remove =
        normalizeToppingList(source.remove);

    const note =
        String(
            source.note ||
            source.ghiChu ||
            ""
        ).trim();

        const giaVi = source.giaVi || {};


    // Không cho cùng 1 topping nằm ở cả 2 phía
    const removeSet =
        new Set(remove);

    only =
        only.filter(
            topping =>
                !removeSet.has(topping)
        );


    // =========================
    // 12/12 = THẬP CẨM
    // =========================

    if (
        only.length === TOPPINGS.length ||
        remove.length === TOPPINGS.length
    ) {
        return note
            ? {
                only: [],
                remove: [],
                note
            }
            : null;
    }


    // =========================
    // CHỈ ĂN > 1/2
    // Ví dụ 7/12
    // =========================

    if (
        only.length >
        TOPPINGS.length / 2
    ) {

        remove =
            TOPPINGS.filter(
                topping =>
                    !only.includes(topping)
            );

        only = [];
    }


    // =========================
    // KHÔNG ĂN > 1/2
    // Ví dụ 7/12
    // =========================

    else if (
        remove.length >
        TOPPINGS.length / 2
    ) {

        only =
            TOPPINGS.filter(
                topping =>
                    !remove.includes(topping)
            );

        remove = [];
    }


    // Không có tùy chỉnh
    if (
        only.length === 0 &&
        remove.length === 0 &&
        note === "" &&
        Object.keys(giaVi).length === 0
    ) {
        return null;
    }


    return {
        only,
        remove,
        giaVi,
        note
    };
}


function extractBowls(product) {

    const qty =
        clampQty(product?.soLuong);

    if (!qty) {
        return [];
    }


    const source =
        Array.isArray(product?.cacBat)
            ? product.cacBat
            : Array.isArray(product?.bats)
                ? product.bats
                : [];


    const bowls = [];


    for (
        let i = 0;
        i < qty;
        i++
    ) {

        const raw =
            source[i] || null;


        bowls.push(
            normalizeBowlCustomization(raw)
        );
    }


    return bowls;
}


function bowlDisplay(
    customization,
    defaultType
) {

    if (!customization) {

        return defaultType;
    }


    const lines = [];


    if (
        customization.only &&
        customization.only.length > 0
    ) {

        lines.push(
            "CHI AN: " +
            customization.only.join(", ")
        );
    }


    if (
        customization.remove &&
        customization.remove.length > 0
    ) {

        lines.push(
            "KHONG AN: " +
            customization.remove.join(", ")
        );
    }


    if (
        customization.note
    ) {

        lines.push(
            "GHI CHU: " +
            customization.note
        );
    }


    return (
        lines.join("\n") ||
        defaultType
    );
}


function formatWrapped(
    text,
    maxLen = 34
) {

    const rawLines =
        String(text || "")
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);


    const output = [];


    for (
        const line of rawLines
    ) {

        const words =
            line.split(/\s+/);

        let current = "";


        for (
            const word of words
        ) {

            if (!current) {

                current = word;
                continue;
            }


            const candidate =
                current + " " + word;


            if (
                candidate.length >
                maxLen
            ) {

                output.push(current);

                current = word;

            } else {

                current = candidate;
            }
        }


        if (current) {

            output.push(current);
        }
    }


    return output;
}


function pad(text, len) {

    const value =
        String(text ?? "");


    if (
        value.length >= len
    ) {

        return value.slice(
            0,
            len
        );
    }


    return (
        value +
        " ".repeat(
            len - value.length
        )
    );
}


function money(value) {

    return Number(value || 0)
        .toLocaleString("vi-VN") +
        "đ";
}

function normalizeVoucherCode(code) {

    return String(code || "")
        .trim()
        .toUpperCase();
}

function getBowlPresentation(
    customization,
    defaultType
) {
    if (!customization) {
        return {
            main: defaultType,
            note: ""
        };
    }

    let main = defaultType;

    if (
        customization.only &&
        customization.only.length > 0
    ) {
        main =
            "✅ Chỉ ăn: " +
            customization.only.join(", ");
    }

    if (
        customization.remove &&
        customization.remove.length > 0
    ) {
        main =
            "❌ Không ăn: " +
            customization.remove.join(", ");
    }

    return {
        main,
        note: customization.note || "",
        giaVi: customization.giaVi || {}
    };
}

function formatMessage(data) {
    let totalMoney = 0;

    const lines = [];

    lines.push(
        `═════ 🍜 ĐƠN MỚI - BÀN ${data.soBan} ═════`,
        "",
        "══════ 📦 ĐỒ ĂN ══════",
        ""
    );

    function addFood(
        name,
        product,
        unitPrice,
        defaultType
    ) {
        const qty = clampQty(
            product?.soLuong
        );

        if (!qty) {
            return;
        }

        const total =
            qty * unitPrice;

        totalMoney += total;

        lines.push(
            pad(name, 18) +
            " | SL:" +
            pad(qty, 4) +
            " | " +
            pad(money(total), 14)
        );

        const bowls =
            extractBowls(product);

        const groups = new Map();

        for (
            const customization
            of bowls
        ) {
            const presentation =
                getBowlPresentation(
                    customization,
                    defaultType
                );

            const key =
                JSON.stringify({
                    main: presentation.main,
                    note: presentation.note,
                    customization: customization
                });

            if (groups.has(key)) {
                groups.get(key).qty += 1;
            } else {
                groups.set(
                    key,
                    {
                        qty: 1,
                        main: presentation.main,
                        note: presentation.note,
                        giaVi: presentation.giaVi,
                        customization: customization
                    }
                );
            }
        }

        for (
            const group
            of groups.values()
        ) {

            // Bát mặc định:
            // không cần in thêm dòng "1 x Thập cẩm..."
            const hasGiaVi =
                group.giaVi &&
                Object.keys(group.giaVi).length > 0;


            const isDefault =
                group.main === defaultType &&
                !group.note &&
                !hasGiaVi;

            // Không in tên topping mặc định
            if (!isDefault) {
                lines.push(
                    `   ${group.qty} x ${group.main}`
                );
            }

            if (
                group.giaVi &&
                Object.keys(group.giaVi).length
            ) {

                const boGiaVi =
                    Object.keys(group.giaVi)
                    .filter(
                        x => group.giaVi[x] === "Không"
                    );

                if (boGiaVi.length) {

                    lines.push(
                        `       🧂 Bỏ gia vị: ${boGiaVi.join(", ")}`
                    );

                }
            }

            // Ghi chú luôn là dòng cuối của phần tùy chỉnh bát.
            if (group.note) {

                for (
                    const noteLine of
                    formatWrapped(
                        group.note,
                        28
                    )
                ) {
                    lines.push(
                        `       📝 ${noteLine}`
                    );
                }
            }
        }

        lines.push("");
    }

    // =========================
    // THẬP CẨM
    // =========================

    addFood(
        "Trắng",
        data.thapCam?.trang,
        30000,
        "Thập cẩm"
    );

    addFood(
        "Đỏ",
        data.thapCam?.do,
        30000,
        "Thập cẩm"
    );

    addFood(
        "Bún",
        data.thapCam?.bun,
        30000,
        "Thập cẩm"
    );

    // =========================
    // SIÊU TOPPING
    // =========================

    addFood(
        "Trắng 50k",
        data.sieuTopping?.trang,
        50000,
        "Siêu topping"
    );

    addFood(
        "Đỏ 50k",
        data.sieuTopping?.do,
        50000,
        "Siêu topping"
    );

    addFood(
        "Bún 50k",
        data.sieuTopping?.bun,
        50000,
        "Siêu topping"
    );

    // =========================
    // TRỘN
    // =========================

    addFood(
        "Trắng trộn",
        data.tron?.trang,
        35000,
        "Trộn thập cẩm"
    );

    addFood(
        "Đỏ trộn",
        data.tron?.do,
        35000,
        "Trộn thập cẩm"
    );

    addFood(
        "Bún trộn",
        data.tron?.bun,
        35000,
        "Trộn thập cẩm"
    );

    // =========================
    // TRỘN THẬP CẨM SIÊU TOPPING
    // =========================

    addFood(
        "Trắng trộn 50k",
        data.tronThapCamSieuTopping?.trang,
        50000,
        "Trộn thập cẩm siêu topping"
    );

    addFood(
        "Đỏ trộn 50k",
        data.tronThapCamSieuTopping?.do,
        50000,
        "Trộn thập cẩm siêu topping"
    );

    addFood(
        "Bún trộn 50k",
        data.tronThapCamSieuTopping?.bun,
        50000,
        "Trộn thập cẩm siêu topping"
    );

    // =========================
    // NƯỚC UỐNG
    // =========================

    const drinkLines = [];

    function addDrink(
        name,
        item,
        unitPrice
    ) {
        const qty = clampQty(
            item?.soLuong
        );

        if (!qty) {
            return;
        }

        const total =
            qty * unitPrice;

        totalMoney += total;

        drinkLines.push(
            pad(name, 18) +
            " | SL:" +
            pad(qty, 4) +
            " | " +
            pad(money(total), 14)
        );

        const note =
            String(
                item?.ghiChu ||
                item?.note ||
                ""
            ).trim();

        if (note) {
            for (
                const noteLine of
                formatWrapped(
                    note,
                    28
                )
            ) {
                drinkLines.push(
                    `   📝 ${noteLine}`
                );
            }
        }

        drinkLines.push("");
    }

    addDrink(
        "Nước sâm",
        data.nuocUong?.nuocSam,
        5000
    );

    addDrink(
        "Nước vối",
        data.nuocUong?.nuocVoi,
        5000
    );

    addDrink(
        "Nước ngọt",
        data.nuocUong?.nuocNgot,
        15000
    );

    if (drinkLines.length > 0) {
        lines.push(
            "══════ 🥤 NƯỚC UỐNG ══════",
            "",
            ...drinkLines
        );
    }

    // =========================
    // VOUCHER
    // =========================

    const voucherCode =
        normalizeVoucherCode(
            data.voucherCode
        );

    const voucherGift =
        getVoucherGift(
            voucherCode
        );

    if (
        voucherCode &&
        voucherGift
    ) {
        lines.push(
            "",
            "══════ 🎁 VOUCHER ══════",
            "",
            voucherGift,
            ""
        );
    }

    // =========================
    // TỔNG
    // =========================

    lines.push(
        "",
        pad("TỔNG:", 18) +
        "   " +
        money(totalMoney),
        ""
    );

    // =========================
    // FOOTER
    // =========================

    const footerLines =
        FOOTER_NOTE.split("\n");

    for (
        const line of footerLines
    ) {
        lines.push(
            centerText(line)
        );
    }

    return lines.join("\n");
}

app.post("/api/save", async (req, res) => {

    const data = req.body || {};


    if (!data.soBan) {

        return res.status(400).json({
            message: "Thiếu số bàn"
        });
    }


    console.log(
        "===== DATA ORDER ====="
    );

    console.log(
        JSON.stringify(
            data,
            null,
            2
        )
    );


    const message =
        formatMessage(data);


    console.log(
        "===== DISCORD MESSAGE ====="
    );

    console.log(message);


    try {

        const discordResponse = await fetch(
            DISCORD_WEBHOOK_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: DISCORD_WEBHOOK_USERNAME,
                    avatar_url: DISCORD_WEBHOOK_AVATAR_URL,
                    content: message
                })
            }
        );

        if (!discordResponse.ok) {

            const errorText =
                await discordResponse.text();

            console.error(
                "❌ Discord từ chối webhook:",
                discordResponse.status,
                errorText
            );

            return res.status(500).json({
                message: "Không thể gửi đơn tới Discord"
            });
        }

        console.log(
            "✅ Đã gửi Discord"
        );


    } catch (error) {

        console.error(
            "❌ Lỗi gửi Discord:",
            error
        );


        return res.status(500).json({
            message:
                "Lỗi gửi Discord"
        });
    }


    return res.json({

        message:
            "Đã nhận đơn hàng",

        pretty:
            data,

        discordMessage:
            message
    });

});

// start

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});

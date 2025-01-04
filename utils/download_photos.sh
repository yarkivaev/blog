#!/bin/bash

sequence=(
    13/0737 13/0727 13/0509 13/0353 13/0317 14/0834 13/0366 15/0083 14/0478 14/0449
    13/0520 13/0707 13/0578 13/0646 14/0233 13/0967 13/0073 13/0741 13/0106 13/0775
    13/0773 13/0760 14/0691 13/0049 14/0441 14/0443 15/0473 15/0394 15/0930 15/0514
    15/0818 15/0849 15/0623 15/0554 15/0175 15/0158 15/0162 15/0165 15/0191 15/0245
    15/0235 15/0236 15/0254 15/0259 15/0351 15/0305 15/0325
)

for item in "${sequence[@]}"; do
    prefix="${item%/*}"
    number="${item#*/}"
    
    formatted_item="${prefix}/DSC_${number}.JPG"
    echo "Downloading: $item"
    aws s3 --endpoint-url https://storage.yandexcloud.net cp s3://travel-yarkivaev/2024/01/$formatted_item $formatted_item
done


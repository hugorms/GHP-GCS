$key = "C:\Users\roberthp\.ssh\id_ed25519"
$remote = "rober@10.51.16.19"
$cmd = 'C:\PROGRA~1\Docker\Docker\RESOUR~1\bin\docker.exe compose -f C:\Users\Rober\plane\docker-compose-community.yml up -d'
ssh -i $key $remote "cmd /c `"$cmd`""

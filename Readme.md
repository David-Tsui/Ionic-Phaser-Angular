###How to run the ipa project?
####Install node.js (latest version is prefered).
```sh
npm install -g cordova ionic
```
```sh
ionic platform add android
```
(After USB connected)
```sh
ionic run android
```

####模擬機(not recommend)
```sh
ionic platform add android
```
```sh
ionic build android
```
```sh
ionic emulate android
```

##實機
```sh
ionic platform add android
```
```sh
ionic build android
```
```sh
ionic run android
```

######以上兩者若遇到build問題，若retry yee兩次仍有問題
######先ionic platform remove android 之後再add


##瀏覽器
```sh
ionic serve
```

##透過Ionic view看成品，要先創一個account
```sh
ionic login
```
```sh
ionic upload
```

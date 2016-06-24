##How to run the ipa project?
####Install node.js (latest version is prefered).
- npm install -g cordova ionic
- ionic platform add android
(After USB connected)
- ionic run android

####模擬機(not recommend)
- ionic platform add android
- ionic build android
- ionic emulate android

##實機
ionic platform add android
ionic build android
ionic run android

######以上兩者若遇到build問題，若retry yee兩次仍有問題
######先ionic platform remove android 之後再add


##瀏覽器
####ionic serve

##透過Ionic view看成品，要先創一個account
```sh
ionic login
```
```sh
ionic upload
```

# PyMySQL como reemplazo de mysqlclient (driver MySQL 100% Python).
# Django espera que el driver MySQL se llame "MySQLdb", así que registramos
# PyMySQL bajo ese alias. Esto permite usar 'django.db.backends.mysql'
# sin necesidad de compilar extensiones C (mysqlclient requiere mysql.h).
import pymysql
pymysql.install_as_MySQLdb()
